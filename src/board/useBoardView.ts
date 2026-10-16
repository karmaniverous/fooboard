/**
 * A dashboard's view settings on this device (spec.md C-13): zoom and row
 * height, read from and saved to the preferences store. Zoom is saved with
 * the board's size and resets to Fit when that size changes; switching
 * dashboards loads that dashboard's own settings.
 *
 * @module
 */
import { useState } from 'react';

import type { RowHeight } from '@/domain/config/devicePreferences';
import { useStores } from '@/storage/storesContext';

import { boardSizeKey, clampZoom, MIN_ZOOM, restoredZoom } from './zoom';

export interface BoardView {
  zoom: number;
  setZoom: (zoom: number) => void;
  rowHeight: RowHeight;
  setRowHeight: (rowHeight: RowHeight) => void;
}

interface ViewState {
  dashboardId: string;
  sizeKey: string;
  zoom: number;
  rowHeight: RowHeight;
}

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
      zoom: restoredZoom(saved, sizeKey),
      rowHeight: saved.rowHeight,
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
    current = { ...state, sizeKey, zoom: MIN_ZOOM };
    setState(current);
  }

  return {
    zoom: current.zoom,
    setZoom: (next) => {
      const zoom = clampZoom(next);
      setState({ ...current, zoom });
      preferences.setView(dashboardId, { zoom, boardSize: sizeKey });
    },
    rowHeight: current.rowHeight,
    setRowHeight: (rowHeight) => {
      setState({ ...current, rowHeight });
      preferences.setView(dashboardId, { rowHeight });
    },
  };
}
