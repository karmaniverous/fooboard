/**
 * Tests that the board's Problems panel offers *Copy problems for your
 * assistant* for the configuration's own problems (spec 0.2.0 §3.J
 * *Problems after a valid import*): a board whose stage has no rule for
 * its rows lists that problem, and the panel offers to copy it.
 *
 * @module
 */
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { COPY_PROBLEMS } from '@/board/ProblemsPanel';
import { DashboardSchema } from '@/domain/config/dashboard';
import { branchRules } from '@/domain/config/placement';
import { createAppStores } from '@/storage';
import { memoryStorage } from '@/storage/keyValue';
import { renderFirstRun } from '@/test/renderFirstRun';

describe("the board's Problems panel", () => {
  it("offers to copy the configuration's problems for an assistant", async () => {
    const stores = createAppStores(memoryStorage());
    stores.config.saveDashboard(
      DashboardSchema.parse({
        id: 'acme',
        name: 'Acme',
        stages: [
          { id: 'dev', name: 'Dev', rules: branchRules('dev') },
          { id: 'prod', name: 'Prod', rules: {} },
        ],
        rows: [
          { type: 'github', id: 'web', repo: 'acme/web', displayName: 'Web' },
        ],
      }),
    );
    await renderFirstRun('/d/acme', stores);
    fireEvent.click(screen.getByRole('button', { name: /^Problems \(\d+\)$/ }));
    expect(
      await screen.findByRole('button', { name: COPY_PROBLEMS }),
    ).toBeVisible();
  });
});
