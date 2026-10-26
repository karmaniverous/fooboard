/**
 * Tests for creating a dashboard through the first run (spec.md §3.9,
 * C-22) against a simulated GitHub account: the token, with its guide a
 * click away, becomes the dashboard's `githubToken`; the repos it sees
 * become rows; the suggested preset and the preview stages named from
 * `preview/*` branches become the stages, as adjusted; the board opens
 * with its unmapped runs counted; new dashboards use the built-in rules;
 * and every step moves focus to its heading.
 *
 * @module
 */
import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { branchOf } from '@/domain/rules/branch';
import { choose } from '@/test/choose';
import {
  FIRST_RUN_TOKEN,
  savedDashboard,
  stubSimulatedGitHub,
} from '@/test/firstRunWorld';
import { renderFirstRun } from '@/test/renderFirstRun';

beforeEach(() => {
  stubSimulatedGitHub();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

/** Step 1, from the empty app: name the dashboard and add the token. */
async function addToken(name = 'Acme') {
  const stores = await renderFirstRun();
  fireEvent.click(screen.getByRole('link', { name: 'Create a dashboard' }));
  await screen.findByRole('heading', { name: 'Add a GitHub token' });
  fireEvent.change(screen.getByLabelText('Dashboard name'), {
    target: { value: name },
  });
  fireEvent.change(screen.getByLabelText('Token'), {
    target: { value: FIRST_RUN_TOKEN },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Add the token' }));
  await screen.findByRole('heading', { name: 'Pick your repos' });
  return stores;
}

/** Step 2: tick `repos` and go on to the stages. */
async function pickRepos(repos = ['acme/api', 'acme/web']) {
  for (const repo of repos) {
    fireEvent.click(await screen.findByRole('checkbox', { name: repo }));
  }
  fireEvent.click(screen.getByRole('button', { name: /^Next: set up stages/ }));
  await screen.findByRole('heading', { name: 'Set up your stages' });
}

describe('first run: token', () => {
  it('moves focus to the heading and links the guide to creating a token', async () => {
    await renderFirstRun('/new');
    expect(screen.getByText('Step 1 of 4')).toBeVisible();
    expect(
      screen.getByRole('heading', { name: 'Add a GitHub token' }),
    ).toHaveFocus();
    expect(
      screen.getByRole('link', { name: 'How to create a read-only token' }),
    ).toHaveAttribute('href', expect.stringContaining('#github-token'));
  });

  it("makes the first token the dashboard's githubToken, with the built-in rules", async () => {
    const stores = await addToken();
    const saved = savedDashboard(stores);
    const token = saved.credentials.at(0);
    expect(saved.name).toBe('Acme');
    expect(token).toMatchObject({ kind: 'github', label: 'GitHub token' });
    expect(saved.settings.githubToken).toBe(token?.id);
    expect(stores.credentials.get(token?.id ?? '')).toEqual({
      kind: 'github',
      token: FIRST_RUN_TOKEN,
    });
    // No custom source rules or status sets: the built-ins apply.
    expect(saved.sourceRules).toEqual({ github: 'github', amplify: 'amplify' });
    expect(saved.customSourceRules).toEqual([]);
    expect(saved.customStatusSets).toEqual([]);
    expect(saved.settings.statusSets).toBeUndefined();
    expect(saved.settings.itemRules).toBeUndefined();
  });

  it('names a dashboard left unnamed', async () => {
    const stores = await renderFirstRun('/new');
    fireEvent.change(screen.getByLabelText('Token'), {
      target: { value: FIRST_RUN_TOKEN },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add the token' }));
    await screen.findByRole('heading', { name: 'Pick your repos' });
    expect(screen.getByText('Step 2 of 4')).toBeVisible();
    expect(savedDashboard(stores).name).toBe('My dashboard');
  });
});

describe('first run: repos', () => {
  it('lists the repos the token sees and saves a row for each ticked one', async () => {
    const stores = await addToken();
    expect(
      screen.getByRole('heading', { name: 'Pick your repos' }),
    ).toHaveFocus();
    expect(
      await screen.findByRole('checkbox', { name: 'acme/docs' }),
    ).not.toBeChecked();
    const next = screen.getByRole('button', { name: /^Next: set up stages/ });
    expect(next).toBeDisabled();
    await pickRepos();
    const saved = savedDashboard(stores);
    expect(saved.rows.map((r) => r.repo)).toEqual(['acme/api', 'acme/web']);
    // Each row reads with the dashboard's token.
    expect(saved.rows.every((r) => r.settings.githubToken === undefined)).toBe(
      true,
    );
  });
});

describe('first run: stages', () => {
  it('suggests the best-fitting preset and names preview stages from preview/* branches', async () => {
    await addToken();
    await pickRepos();
    expect(
      screen.getByRole('heading', { name: 'Set up your stages' }),
    ).toHaveFocus();
    expect(
      await screen.findByText(
        'Suggested from the branches in your 2 repos: Release train.',
      ),
    ).toBeVisible();
    expect(
      screen.getByRole('combobox', { name: 'Starting stages' }),
    ).toHaveTextContent(
      'Release train: dev, previews, release/**, main (suggested)',
    );
    // bali is in both repos, texas in one: the commoner first.
    const previews = screen.getAllByRole('checkbox');
    expect(previews.map((c) => c.getAttribute('aria-checked'))).toEqual([
      'true',
      'true',
    ]);
    expect(screen.getByLabelText('bali (preview/bali)')).toBeChecked();
    expect(screen.getByLabelText('texas (preview/texas)')).toBeChecked();
    const stages = within(screen.getByRole('list', { name: 'Stages' }));
    expect(stages.getAllByRole('listitem').map((li) => li.textContent)).toEqual(
      [
        'devdevin 2 of 2 repos',
        'balipreview/baliin 2 of 2 repos',
        'texaspreview/texasin 1 of 2 repos',
        'releaserelease/**no branch matches yet',
        'prodmainin 2 of 2 repos',
      ],
    );
  });

  it('lets the user adjust, and opens the board with its unmapped runs flagged', async () => {
    const stores = await addToken();
    await pickRepos();
    fireEvent.click(await screen.findByLabelText('texas (preview/texas)'));
    fireEvent.click(screen.getByRole('button', { name: 'Show the board' }));
    const note = await screen.findByRole('heading', { name: 'Your board' });
    expect(note).toHaveFocus();
    expect(screen.getByText('Step 4 of 4')).toBeVisible();
    const saved = savedDashboard(stores);
    expect(saved.stages.map((s) => [s.name, branchOf(s.rules.github)])).toEqual(
      [
        ['dev', 'dev'],
        ['bali', 'preview/bali'],
        ['release', 'release/**'],
        ['prod', 'main'],
      ],
    );
    // Runs on feature/login and preview/texas land in no cell.
    const unmapped = await screen.findByRole('button', {
      name: /^Unmapped \(\d+\)$/,
    });
    const count = /\d+/.exec(unmapped.textContent)?.[0] ?? '';
    expect(
      screen.getByText(
        new RegExp(`${count} runs land in no cell: Unmapped \\(${count}\\)`),
      ),
    ).toBeVisible();
  });

  it('starts blank when the user chooses Blank', async () => {
    const stores = await addToken();
    await pickRepos();
    await screen.findByText(/^Suggested from/);
    choose(
      screen.getByRole('combobox', { name: 'Starting stages' }),
      'Blank: add stages yourself',
    );
    expect(screen.queryByRole('list', { name: 'Stages' })).toBeNull();
    expect(screen.queryByRole('checkbox')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show the board' }));
    await screen.findByRole('heading', { name: 'Your board' });
    expect(savedDashboard(stores).stages).toEqual([]);
  });
});
