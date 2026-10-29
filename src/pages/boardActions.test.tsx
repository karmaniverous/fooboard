/**
 * A saved dashboard's actions beside its title (spec 0.2.0 §3.A; #53):
 * icon buttons named by the title of what each opens, with its count,
 * after the batteries; every one ghost, as the header's buttons are, its
 * emphasis the icon's colour (Decision 104): *Problems* destructive and
 * *Add a credential* primary; a button with a count only while its count
 * is above zero;
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

/** Is `button` in the header's ghost style: no outline or fill? */
const ghost = (button: HTMLElement): boolean =>
  !/(^|\s)(border|bg-)/.test(button.className) &&
  button.className.includes('hover:bg-accent');

/** The colour class of `button`'s icon, if any. */
const iconTone = (button: HTMLElement): string | undefined =>
  button
    .querySelector('svg')
    ?.getAttribute('class')
    ?.split(' ')
    .find((c) => /^text-(destructive|primary)$/.test(c));

/** The board has read its rows (none has a credential). */
const settled = () =>
  screen.findAllByRole('button', { name: /needs credential/, hidden: true });

describe('the board actions', () => {
  it('asks for a credential with a primary icon, every button ghost', async () => {
    await renderDashboardPage({ id: 'mine', name: 'My board' });
    expect(actionNames()).toEqual([
      'Legend',
      'Edit dashboard',
      'Add a credential',
    ]);
    for (const name of ['Legend', 'Edit dashboard', 'Add a credential'])
      expect(ghost(action(name))).toBe(true);
    expect(iconTone(action('Add a credential'))).toBe('text-primary');
    for (const name of ['Legend', 'Edit dashboard'])
      expect(iconTone(action(name))).toBeUndefined();
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
      settings: { githubToken: 'gh' },
      rows: [githubRow],
    });
    expect(ghost(action('Credentials'))).toBe(true);
    expect(iconTone(action('Credentials'))).toBeUndefined();
    // The battery comes first, before Legend.
    const actions = screen.getByTestId('board-actions');
    const battery =
      await within(actions).findByLabelText(/^GitHub GitHub token/);
    expect(
      battery.compareDocumentPosition(action('Legend')) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: 'Add a credential' }),
    ).toBeNull();
  });

  it('counts problems on a ghost button with a destructive icon that opens Problems', async () => {
    await renderDashboardPage({
      id: 'p',
      name: 'P',
      rows: [githubRow],
      stages: [{ id: 'dev', name: 'Dev' }],
    });
    await settled();
    const problems = action(/^Problems \(\d+\)$/);
    expect(ghost(problems)).toBe(true);
    expect(iconTone(problems)).toBe('text-destructive');
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
    expect(ghost(notes)).toBe(true);
    expect(iconTone(notes)).toBeUndefined();
    expect(screen.queryByRole('button', { name: /^Problems/ })).toBeNull();
    fireEvent.click(notes);
    expect(screen.getByRole('dialog', { name: 'Notes' })).toBeVisible();
  });
});
