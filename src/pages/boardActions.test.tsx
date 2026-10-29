/**
 * A saved dashboard's actions beside its title (spec 0.2.0 §3.A; #53):
 * icon buttons named by the title of what each opens, with its count;
 * *Problems* destructive and *Add a credential* primary, the rest
 * outlined; a button with a count only while its count is above zero;
 * the panel *Notes (N)* opens is titled *Notes*; a counted button's
 * tooltip is its name, count included. (The demo's actions,
 * *Unmapped runs (N)* among them, are found by name in
 * `DashboardViewFixes.test.tsx`.)
 *
 * @module
 */
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { branchRules } from '@/domain/config/placement';
import { focusElement } from '@/test/focus';
import { renderDashboardPage } from '@/test/renderDashboardPage';

const githubRow = {
  type: 'github',
  id: 'api',
  repo: 'acme/api',
  displayName: 'api',
} as const;

/** The board's actions, by accessible name. */
const actionNames = (): string[] =>
  within(screen.getByTestId('board-actions'))
    .getAllByRole('button')
    .map((b) => b.getAttribute('aria-label') ?? '')
    .filter((name) => !/needs credential|^GitHub/.test(name));

/** The board's action named `name`. */
const action = (name: string | RegExp): HTMLElement =>
  within(screen.getByTestId('board-actions')).getByRole('button', { name });

/** The board has read its rows (none has a credential). */
const settled = () =>
  screen.findAllByRole('button', { name: /needs credential/, hidden: true });

describe('the board actions', () => {
  it('asks for a credential with a primary button, the rest outlined', async () => {
    await renderDashboardPage({ id: 'mine', name: 'My board' });
    expect(actionNames()).toEqual([
      'Legend',
      'Edit dashboard',
      'Add a credential',
    ]);
    expect(action('Add a credential')).toHaveClass('bg-primary');
    for (const name of ['Legend', 'Edit dashboard'])
      expect(action(name)).toHaveClass('border-border');
    // No count above zero, so no Problems, Notes or Unmapped runs.
    expect(
      screen.queryByRole('button', { name: /^(Problems|Notes|Unmapped)/ }),
    ).toBeNull();
  });

  it('names Credentials once the dashboard has one', async () => {
    await renderDashboardPage({
      id: 'mine',
      name: 'My board',
      credentials: [{ id: 'gh', kind: 'github', label: 'GitHub token' }],
    });
    expect(action('Credentials')).toHaveClass('border-border');
    expect(
      screen.queryByRole('button', { name: 'Add a credential' }),
    ).toBeNull();
  });

  it('counts problems on a destructive button that opens Problems', async () => {
    await renderDashboardPage({
      id: 'p',
      name: 'P',
      rows: [githubRow],
      stages: [{ id: 'dev', name: 'Dev' }],
    });
    await settled();
    const problems = action(/^Problems \(\d+\)$/);
    expect(problems).toHaveClass('bg-destructive');
    // Its tooltip is its name, count included.
    focusElement(problems);
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      problems.getAttribute('aria-label') ?? '',
    );
    fireEvent.click(problems);
    expect(screen.getByRole('dialog', { name: 'Problems' })).toBeVisible();
  });

  it('counts notes, when there are only notes, on a button that opens Notes', async () => {
    await renderDashboardPage({
      id: 'd',
      name: 'D',
      stages: [{ id: 'dev', name: 'Dev', rules: branchRules('dev') }],
    });
    const notes = action(/^Notes \(\d+\)$/);
    expect(notes).toHaveClass('border-border');
    expect(screen.queryByRole('button', { name: /^Problems/ })).toBeNull();
    fireEvent.click(notes);
    expect(screen.getByRole('dialog', { name: 'Notes' })).toBeVisible();
  });
});
