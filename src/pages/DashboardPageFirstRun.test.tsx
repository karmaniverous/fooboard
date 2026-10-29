/**
 * Tests for the first run's last step (spec.md §3.9): opened at the end of
 * the steps, a board shows the note whose heading takes focus, counting
 * its rule problems; *Done* closes it for good, moving focus to the
 * board's title; opened any other way, the board has no note.
 *
 * @module
 */
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DashboardSchema } from '@/domain/config/dashboard';
import { FIRST_RUN_STATE } from '@/firstRun/paths';
import { createAppStores } from '@/storage';
import { memoryStorage } from '@/storage/keyValue';
import { renderFirstRun } from '@/test/renderFirstRun';

/** Stores with a board whose one stage has no rule: a rule problem. */
function storesWithProblem() {
  const stores = createAppStores(memoryStorage());
  stores.config.saveDashboard(
    DashboardSchema.parse({
      id: 'acme',
      name: 'Acme',
      rows: [
        { type: 'github', id: 'api', repo: 'acme/api', displayName: 'api' },
      ],
      stages: [{ id: 'dev', name: 'dev', rules: {} }],
    }),
  );
  return stores;
}

describe('the first run on the board', () => {
  it('counts the rule problems, and Done closes the note for good', async () => {
    await renderFirstRun(
      { pathname: '/d/acme', state: FIRST_RUN_STATE },
      storesWithProblem(),
    );
    expect(screen.getByRole('heading', { name: 'Your board' })).toHaveFocus();
    expect(screen.getByText('Step 4 of 4')).toBeVisible();
    expect(
      screen.getByText(
        /1 rule problem is marked ! on the board and listed under Problems \(1\)\./,
      ),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Problems (1)' })).toBeVisible();
    expect(
      screen.getByText(
        /Runs that land in no cell will be listed under Unmapped runs\./,
      ),
    ).toBeVisible();
    expect(screen.getByTestId('location-state')).toHaveTextContent(
      '{"firstRun":true}',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    // A reload or Back won't bring the note back.
    expect(screen.getByTestId('location-state')).toHaveTextContent('null');
    expect(screen.queryByRole('heading', { name: 'Your board' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Acme' })).toHaveFocus();
  });

  it('has no note when opened any other way', async () => {
    await renderFirstRun('/d/acme', storesWithProblem());
    expect(screen.getByRole('heading', { name: 'Acme' })).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Your board' })).toBeNull();
  });
});
