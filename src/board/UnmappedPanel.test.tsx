/**
 * Tests for the unmapped runs flow: the panel lists each run with its
 * reason, and *Add test* opens the editor on the right row with the test
 * pre-filled; adding it saves the dashboard.
 *
 * @module
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { type Dashboard, DashboardSchema } from '@/domain/config/dashboard';
import { DashboardEditor } from '@/editors/DashboardEditor';
import { draftFor, type EditorDraft } from '@/editors/draft';
import type { UnmappedRun } from '@/engine';
import { createAppStores } from '@/storage';
import { memoryStorage } from '@/storage/keyValue';
import { StoresContext } from '@/storage/storesContext';

import { UnmappedPanel } from './UnmappedPanel';

const dashboard = DashboardSchema.parse({
  id: 'd',
  name: 'D',
  rows: [{ type: 'github', id: 'api', repo: 'acme/api', displayName: 'api' }],
});
const runs: UnmappedRun[] = [
  {
    repo: 'acme/api',
    runId: 7,
    workflowName: 'Deploy API',
    branch: 'main',
    htmlUrl: 'https://github.com/acme/api/actions/runs/7',
    reason: { kind: 'no-row-key-matches' },
  },
  {
    repo: 'acme/gone',
    runId: 8,
    workflowName: 'Nightly',
    branch: 'main',
    htmlUrl: 'https://github.com/acme/gone/actions/runs/8',
    reason: { kind: 'no-row-key-matches' },
  },
];

describe('UnmappedPanel', () => {
  it('lists runs with their reasons, offering Add test only where it can help', () => {
    render(
      <UnmappedPanel
        runs={runs}
        onAddTest={(r) => (draftFor(r, dashboard) ? vi.fn() : undefined)}
      />,
    );
    expect(screen.getAllByText('no row key matches')).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'Deploy API' })).toHaveAttribute(
      'target',
      '_blank',
    );
    expect(screen.getAllByRole('button', { name: 'Add test' })).toHaveLength(1);
  });

  it('opens the editor on the row with the test pre-filled', () => {
    const saved = { current: dashboard };
    function Harness(): React.JSX.Element {
      const [d, setD] = useState<Dashboard>(dashboard);
      const [draft, setDraft] = useState<EditorDraft | undefined>();
      return draft ? (
        <DashboardEditor
          dashboard={d}
          providers={{ github: () => undefined, amplify: () => undefined }}
          draft={draft}
          onChange={(next) => {
            saved.current = next;
            setD(next);
          }}
        />
      ) : (
        <UnmappedPanel
          runs={runs}
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
    fireEvent.click(screen.getByRole('button', { name: 'Add test' }));
    expect(screen.getByRole('button', { name: 'Rows' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(
      screen.getByLabelText('New Row key tests for api value'),
    ).toHaveValue('Deploy API');
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(saved.current.rows[0]).toMatchObject({
      rowKeyTests: [
        { field: 'workflowName', operator: 'is', value: 'Deploy API' },
      ],
    });
  });
});
