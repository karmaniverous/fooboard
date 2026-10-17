/**
 * A dashboard's view settings on this device (spec.md C-13): zoom and
 * density, read from and saved to the preferences store. Zoom is saved
 * with the board's size and resets to 100% when that size changes;
 * switching dashboards loads that dashboard's own settings. Zoom is
 * clamped where it is laid out (its upper bound depends on the board).
 *
 * @module
 */
import { useState } from 'react';

import { DEFAULT_ZOOM, type Density } from '@/domain/config/devicePreferences';
import { useStores } from '@/storage/storesContext';

export interface BoardView {
  zoom: number;
  setZoom: (zoom: number) => void;
  density: Density;
  setDensity: (density: Density) => void;
}

interface ViewState {
  dashboardId: string;
  sizeKey: string;
  zoom: number;
  density: Density;
}

const boardSizeKey = (rows: number, stages: number): string =>
  `${String(rows)}x${String(stages)}`;

export function useBoardView(
  dashboardId: string,
  rows: number,
  stages: number,
): BoardView {
  const { preferences } = useStores();
  const sizeKey = boardSizeKey(rows, stages);
  const load = (): ViewState => {
    const saved = preferences.getView(dashboardId);
    return {
      dashboardId,
      sizeKey,
      zoom: saved.boardSize === sizeKey ? saved.zoom : DEFAULT_ZOOM,
      density: saved.density,
    };
  };
  const [state, setState] = useState(load);

  // Adjust during render when the dashboard or its size changes, so the
  // first paint after the change already uses the right settings.
  let current = state;
  if (state.dashboardId !== dashboardId) {
    current = load();
    setState(current);
  } else if (state.sizeKey !== sizeKey) {
    current = { ...state, sizeKey, zoom: DEFAULT_ZOOM };
    setState(current);
  }

  return {
    zoom: current.zoom,
    setZoom: (zoom) => {
      setState({ ...current, zoom });
      preferences.setView(dashboardId, { zoom, boardSize: sizeKey });
    },
    density: current.density,
    setDensity: (density) => {
      setState({ ...current, density });
      preferences.setView(dashboardId, { density });
    },
  };
}
