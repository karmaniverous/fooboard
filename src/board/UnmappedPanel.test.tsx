/**
 * Tests for the unmapped runs flow: the panel lists each run with its
 * reason, and *Add rule* opens the editor on the right row with the rule
 * pre-filled; adding it saves the dashboard.
 *
 * @module
 */
import { fireEvent, screen } from '@testing-library/react';
import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { type Dashboard, DashboardSchema } from '@/domain/config/dashboard';
import { UNMAPPED } from '@/domain/derivation';
import { DashboardEditor } from '@/editors/DashboardEditor';
import { draftFor, type EditorDraft, overrideDraftFor } from '@/editors/draft';
import type { UnmappedRun } from '@/engine';
import { createAppStores } from '@/storage';
import { memoryStorage } from '@/storage/keyValue';
import { StoresContext } from '@/storage/storesContext';
import { envRender } from '@/test/envRender';

import { UnmappedPanel } from './UnmappedPanel';

const render = envRender();

const dashboard = DashboardSchema.parse({
  id: 'd',
  name: 'D',
  rows: [{ type: 'github', id: 'api', repo: 'acme/api', displayName: 'api' }],
});
/** What every panel here shares: the dashboard, no dismissals listed. */
const base = {
  dashboard,
  onChange: vi.fn(),
  showDismissed: false,
  onShowDismissed: vi.fn(),
};
const runs: UnmappedRun[] = [
  {
    provider: 'github',
    id: 'github:acme/api#7',
    where: 'acme/api',
    title: 'Deploy API',
    record: { workflow: 'Deploy API', branch: 'main' },
    branch: 'main',
    htmlUrl: 'https://github.com/acme/api/actions/runs/7',
    reason: { kind: UNMAPPED.noRowMatches },
    rows: [{ rowId: 'api', reason: { kind: UNMAPPED.noRowMatches } }],
  },
  {
    provider: 'github',
    id: 'github:acme/gone#8',
    where: 'acme/gone',
    title: 'Nightly',
    record: { workflow: 'Nightly', branch: 'main' },
    branch: 'main',
    htmlUrl: 'https://github.com/acme/gone/actions/runs/8',
    reason: { kind: UNMAPPED.noRowMatches },
    rows: [],
  },
];

describe('UnmappedPanel', () => {
  it('lists runs with their reasons, offering Add rule only where it can help', () => {
    render(
      <UnmappedPanel
        {...base}
        unmapped={runs}
        onAddTest={(r) => (draftFor(r, dashboard) ? vi.fn() : undefined)}
      />,
    );
    expect(screen.getAllByText('no row rule matches')).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'Deploy API' })).toHaveAttribute(
      'target',
      '_blank',
    );
    expect(screen.getAllByRole('button', { name: 'Add rule' })).toHaveLength(1);
  });

  it('says so when every run has a cell', () => {
    render(
      <UnmappedPanel {...base} unmapped={[]} onAddTest={() => undefined} />,
    );
    expect(
      screen.getByText('Every recent run has a cell.'),
    ).toBeInTheDocument();
  });

  it('gives each row reading the run its own reason, by row name', () => {
    const [first] = runs;
    render(
      <UnmappedPanel
        {...base}
        unmapped={[
          {
            ...first,
            rows: [
              { rowId: 'api', reason: { kind: UNMAPPED.noRowMatches } },
              { rowId: 'web', reason: { kind: UNMAPPED.noOrderKey } },
            ],
          },
        ]}
        rowNames={{ api: 'API' }}
        onAddTest={() => undefined}
      />,
    );
    expect(screen.getByText('API: no row rule matches')).toBeInTheDocument();
    expect(screen.getByText('web: no order key')).toBeInTheDocument();
  });

  it('offers Add override only for a branch no stage matches, on a known repo', () => {
    const branchRuns: UnmappedRun[] = [
      {
        ...runs[0],
        id: 'github:acme/api#9',
        reason: { kind: UNMAPPED.noStageMatches, branch: 'hotfix/1' },
        rows: [
          {
            rowId: 'api',
            reason: { kind: UNMAPPED.noStageMatches, branch: 'hotfix/1' },
          },
        ],
      },
      {
        ...runs[1],
        id: 'github:acme/gone#10',
        reason: { kind: UNMAPPED.noStageMatches, branch: 'x' },
        // No row on the board reads it any more.
        rows: [
          {
            rowId: 'gone',
            reason: { kind: UNMAPPED.noStageMatches, branch: 'x' },
          },
        ],
      },
      ...runs,
    ];
    const add = vi.fn();
    render(
      <UnmappedPanel
        {...base}
        unmapped={branchRuns}
        onAddTest={() => undefined}
        onAddOverride={(r) =>
          overrideDraftFor(r, dashboard) ? add : undefined
        }
      />,
    );
    const buttons = screen.getAllByRole('button', { name: 'Add override' });
    expect(buttons).toHaveLength(1);
    fireEvent.click(buttons[0]);
    expect(add).toHaveBeenCalledOnce();
  });

  it('opens the editor on the row with the test pre-filled', () => {
    const saved = { current: dashboard };
    function Harness(): React.JSX.Element {
      const [d, setD] = useState<Dashboard>(dashboard);
      const [draft, setDraft] = useState<EditorDraft | undefined>();
      return draft ? (
        <DashboardEditor
          dashboard={d}
          draft={draft}
          onChange={(next) => {
            saved.current = next;
            setD(next);
          }}
        />
      ) : (
        <UnmappedPanel
          {...base}
          unmapped={runs}
          onAddTest={(r) => {
            const next = draftFor(r, d);
            return next
              ? () => {
                  setDraft(next);
                }
              : undefined;
          }}
        />
      );
    }
    render(
      <StoresContext value={createAppStores(memoryStorage())}>
        <MemoryRouter>
          <Harness />
        </MemoryRouter>
      </StoresContext>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add rule' }));
    expect(screen.getByRole('tab', { name: 'Rows' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(
      screen.getByRole('group', { name: 'Record rule for api' }),
    ).toBeInTheDocument();
  });
});
