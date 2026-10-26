/**
 * Tests for a saved dashboard's page: it renders the saved board, asks
 * for a credential when it has none, and saves what the credentials panel
 * changes.
 *
 * @module
 */
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { branchRules } from '@/domain/config/placement';
import { expand } from '@/test/openItem';
import { renderDashboardPage } from '@/test/renderDashboardPage';

describe('DashboardPage', () => {
  it('shows the saved board and saves a credential added from it', async () => {
    const stores = await renderDashboardPage({ id: 'mine', name: 'My board' });
    expect(screen.getByRole('heading', { name: 'My board' })).toHaveTextContent(
      'My board',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add a credential' }));
    expect(screen.getByRole('dialog', { name: 'Credentials' })).toBeVisible();
    fireEvent.change(screen.getByLabelText('Token'), {
      target: { value: 'github_pat_1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    const loaded = stores.config.load();
    expect(
      loaded.kind === 'ok' && loaded.root.dashboards[0]?.credentials,
    ).toEqual([
      expect.objectContaining({ kind: 'github', label: 'GitHub token' }),
    ]);
  });
});

describe('DashboardPage credential lifecycle', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('re-reads the board as soon as a token is entered or forgotten', async () => {
    // GitHub answers with no runs, branches or jobs.
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        Promise.resolve(
          new Response(
            JSON.stringify(
              url.includes('/runs')
                ? { total_count: 0, workflow_runs: [] }
                : [],
            ),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        ),
      ),
    );
    await renderDashboardPage({
      id: 'mine',
      name: 'My board',
      rows: [
        { type: 'github', id: 'api', repo: 'acme/api', displayName: 'api' },
      ],
      stages: [{ id: 'prod', name: 'prod', rules: branchRules('main') }],
    });
    await screen.findByRole('button', { name: /needs credential/ });

    fireEvent.click(screen.getByRole('button', { name: 'Add a credential' }));
    fireEvent.change(screen.getByLabelText('Token'), {
      target: { value: 'github_pat_1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    // The modal panel hides the board from queries; close it to look.
    // (Escape would first close a tooltip that focus has opened.)
    const close = () => {
      fireEvent.click(
        within(screen.getByRole('dialog')).getByRole('button', {
          name: 'Close',
        }),
      );
    };
    close();
    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: /needs credential/ }),
      ).toBeNull();
    });
    expect(screen.getAllByRole('gridcell')).toHaveLength(1);
    expect(fetch).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Credentials' }));
    // Credentials start closed (Decision 32).
    expand('GitHub token');
    fireEvent.click(screen.getByRole('button', { name: 'Forget' }));
    close();
    await screen.findByRole('button', { name: /needs credential/ });
  });
});
