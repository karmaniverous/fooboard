/**
 * A dashboard's view settings on this device (spec.md C-13): zoom and row
 * height, read from and saved to the preferences store. Zoom is saved with
 * the board's size and resets to Fit when that size changes.
 *
 * @module
 */
import { useState } from 'react';

import type { RowHeight } from '@/domain/config/devicePreferences';
import { useStores } from '@/storage/storesContext';

import { boardSizeKey, clampZoom, restoredZoom } from './zoom';

export interface BoardView {
  zoom: number;
  setZoom: (zoom: number) => void;
  rowHeight: RowHeight;
  setRowHeight: (rowHeight: RowHeight) => void;
}

export function useBoardView(
  dashboardId: string,
  rows: number,
  stages: number,
): BoardView {
  const { preferences } = useStores();
  const sizeKey = boardSizeKey(rows, stages);
  const [saved] = useState(() => preferences.getView(dashboardId));
  const [zoom, setZoomState] = useState(() => restoredZoom(saved, sizeKey));
  const [rowHeight, setRowHeightState] = useState<RowHeight>(saved.rowHeight);

  return {
    zoom,
    setZoom: (next) => {
      const z = clampZoom(next);
      setZoomState(z);
      preferences.setView(dashboardId, { zoom: z, boardSize: sizeKey });
    },
    rowHeight,
    setRowHeight: (next) => {
      setRowHeightState(next);
      preferences.setView(dashboardId, { rowHeight: next });
    },
  };
}
