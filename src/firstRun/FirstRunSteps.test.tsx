/**
 * Tests for the first run's steps off the main path (spec.md §3.9): a
 * refused save, a tab without the token, a failed read tried again, a
 * token that sees no repos, repos that fit no preset, going back to the
 * repos, a step that doesn't exist (*Page not found*) and a dashboard
 * that doesn't (*Dashboard not found*).
 *
 * @module
 */
import { fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DashboardSchema } from '@/domain/config/dashboard';
import { rowFromRepo } from '@/editors/edit';
import { createAppStores } from '@/storage';
import { memoryStorage } from '@/storage/keyValue';
import {
  FIRST_RUN_TOKEN,
  noReposScenario,
  savedDashboard,
  simulatedFetch,
  stubSimulatedGitHub,
} from '@/test/firstRunWorld';
import { renderFirstRun } from '@/test/renderFirstRun';

import { firstRunPath } from './paths';

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Stores holding a dashboard with the simulated token (its secret held
 * for this tab unless `secret` is false) and rows for `repos`. */
function savedWith(repos: string[] = [], secret = true) {
  const stores = createAppStores(memoryStorage());
  const empty = DashboardSchema.parse({
    id: 'acme',
    name: 'Acme',
    credentials: [{ id: 'gh', kind: 'github', label: 'GitHub token' }],
    settings: { githubToken: 'gh' },
  });
  const dashboard = repos.reduce(
    (d, repo) => ({ ...d, rows: [...d.rows, rowFromRepo(repo, d)] }),
    empty,
  );
  stores.config.saveDashboard(dashboard);
  if (secret) {
    stores.credentials.set(
      'gh',
      { kind: 'github', token: FIRST_RUN_TOKEN },
      false,
    );
  }
  return stores;
}

/** A \`fetch\` that answers 401 for URLs matching \`fail\` until \`heal\`. */
function failingFetch(fail: RegExp) {
  const sim = simulatedFetch();
  let failing = true;
  vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) =>
    failing && fail.test(String(input instanceof Request ? input.url : input))
      ? Promise.resolve(new Response('{}', { status: 401 }))
      : sim(input, init),
  );
  return () => {
    failing = false;
  };
}

describe('first run steps', () => {
  it('reports a refused save and keeps the name for another try', async () => {
    const device = memoryStorage();
    const stores = createAppStores({
      ...device,
      setItem: (key, value) => {
        if (key.startsWith('fooboard:config'))
          throw new Error('storage refused the write');
        device.setItem(key, value);
      },
    });
    await renderFirstRun('/new', stores);
    fireEvent.change(screen.getByLabelText('Dashboard name'), {
      target: { value: 'Acme' },
    });
    fireEvent.change(screen.getByLabelText('Token'), {
      target: { value: FIRST_RUN_TOKEN },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add the token' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'storage refused the write',
    );
    expect(screen.getByLabelText('Dashboard name')).toHaveValue('Acme');
    expect(
      screen.getByRole('heading', { name: 'Add a GitHub token' }),
    ).toBeVisible();
  });

  it('says when the tab no longer holds the token, and links the board', async () => {
    stubSimulatedGitHub();
    await renderFirstRun(firstRunPath('acme', 'repos'), savedWith([], false));
    expect(screen.getByRole('alert')).toHaveTextContent(
      "This tab no longer holds the dashboard's token",
    );
    expect(
      screen.getByRole('link', { name: 'Open the board' }),
    ).toHaveAttribute('href', '/d/acme');
    expect(screen.getByRole('button', { name: /^Next/ })).toBeDisabled();
  });

  it('tries the repos again after a failed read', async () => {
    const heal = failingFetch(/\/user\/repos/);
    await renderFirstRun(firstRunPath('acme', 'repos'), savedWith());
    const again = await screen.findByRole('button', { name: 'Try again' });
    expect(screen.getByRole('alert')).toBeVisible();
    heal();
    fireEvent.click(again);
    expect(
      await screen.findByRole('checkbox', { name: 'acme/api' }),
    ).toBeVisible();
  });

  it('says when the token sees no repos', async () => {
    stubSimulatedGitHub(noReposScenario);
    await renderFirstRun(firstRunPath('acme', 'repos'), savedWith());
    expect(
      await screen.findByText(/This token can't see any repos\./),
    ).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Check its repository access' }),
    ).toHaveAttribute('href', expect.stringContaining('#github-token'));
  });

  it('keeps the rows on a return to the repos, and drops one unticked', async () => {
    stubSimulatedGitHub();
    const stores = savedWith(['acme/api', 'acme/web']);
    await renderFirstRun(firstRunPath('acme', 'stages'), stores);
    await screen.findByText(/^Suggested from/);
    fireEvent.click(screen.getByRole('link', { name: 'Back to repos' }));
    expect(
      await screen.findByRole('heading', { name: 'Pick your repos' }),
    ).toHaveFocus();
    expect(
      await screen.findByRole('checkbox', { name: 'acme/api' }),
    ).toBeChecked();
    fireEvent.click(screen.getByRole('checkbox', { name: 'acme/web' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'acme/docs' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Next: set up stages (2)' }),
    );
    await screen.findByRole('heading', { name: 'Set up your stages' });
    expect(savedDashboard(stores).rows.map((r) => r.repo)).toEqual([
      'acme/api',
      'acme/docs',
    ]);
  });

  it('suggests a blank dashboard when no branch fits a preset', async () => {
    stubSimulatedGitHub();
    await renderFirstRun(
      firstRunPath('acme', 'stages'),
      savedWith(['acme/legacy']),
    );
    expect(
      await screen.findByText(
        /^No branch in your 1 repos matches a preset, so the dashboard starts blank\./,
      ),
    ).toBeVisible();
    expect(
      screen.getByRole('combobox', { name: 'Starting stages' }),
    ).toHaveTextContent('Blank: add stages yourself (suggested)');
  });

  it('tries the branches again after a failed read', async () => {
    const heal = failingFetch(/\/branches/);
    await renderFirstRun(
      firstRunPath('acme', 'stages'),
      savedWith(['acme/api']),
    );
    const again = await screen.findByRole('button', { name: 'Try again' });
    heal();
    fireEvent.click(again);
    expect(await screen.findByText(/^Suggested from/)).toBeVisible();
  });

  it.each([
    [
      'a saved dashboard at an unknown step',
      firstRunPath('acme', 'repos').replace('repos', 'nope'),
      'Page not found',
    ],
    [
      'an unknown dashboard',
      firstRunPath('other', 'repos'),
      'Dashboard not found',
    ],
  ])('shows the not-found page for %s (%s): %s', async (_, path, heading) => {
    await renderFirstRun(path, savedWith());
    expect(screen.getByRole('heading', { name: heading })).toBeVisible();
  });
});
