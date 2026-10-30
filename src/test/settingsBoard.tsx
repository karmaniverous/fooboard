/**
 * Renders the board grid with its settings popup (spec.md §3.11), as
 * `BoardScreen` does: the grid inside `SettingsPopupProvider`, the
 * dashboard held in state so a saved edit re-renders it, and the board's
 * attention (`AttentionContext`, spec 0.2.0 §3.H) a spy. Returns the
 * spies a test asserts on.
 *
 * @module
 */
import { render, type RenderResult } from '@testing-library/react';
import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

import { type Attend, AttentionContext } from '@/board/attentionContext';
import { BoardGrid } from '@/board/BoardGrid';
import type { Layout } from '@/board/layout';
import { SettingsPopupProvider } from '@/board/SettingsPopup';
import type { Dashboard } from '@/domain/config/dashboard';
import type { SettingsPlace } from '@/domain/settings/places';
import type { BoardModel } from '@/engine';

import { TEST_LAYOUT } from './boardLayout';

export interface SettingsBoard {
  view: RenderResult;
  /** Every dashboard the popup saved, in order. */
  onChange: ReturnType<typeof vi.fn<(d: Dashboard) => void>>;
  /** Where *Open in dashboard settings* (or an origin link) went. */
  onOpenSettings: ReturnType<typeof vi.fn<(p: SettingsPlace) => void>>;
  /** Every boost the board asked for, in order. */
  attend: ReturnType<typeof vi.fn<Attend>>;
}

export function renderSettingsBoard(
  dashboard: Dashboard,
  model: BoardModel,
  {
    editor = true,
    save,
    layout = TEST_LAYOUT,
  }: {
    /** The board has a dashboard editor (not the demo, until N3b). */
    editor?: boolean;
    /** Replaces the save (e.g. one that throws). */
    save?: (d: Dashboard) => void;
    layout?: Layout;
  } = {},
): SettingsBoard {
  const onChange = vi.fn<(d: Dashboard) => void>();
  const onOpenSettings = vi.fn<(p: SettingsPlace) => void>();
  const attend = vi.fn<Attend>();
  function Harness(): React.JSX.Element {
    const [d, setD] = useState(dashboard);
    return (
      <AttentionContext value={attend}>
        <SettingsPopupProvider
          dashboard={d}
          onChange={(next) => {
            onChange(next);
            if (save) save(next);
            setD(next);
          }}
          onOpenSettings={editor ? onOpenSettings : undefined}
        >
          <BoardGrid dashboard={d} model={model} layout={layout} now={0} />
        </SettingsPopupProvider>
      </AttentionContext>
    );
  }
  const view = render(
    <MemoryRouter>
      <Harness />
    </MemoryRouter>,
  );
  return { view, onChange, onOpenSettings, attend };
}
