/**
 * Undoing a dismissal in the Unmapped panel (spec 0.2.0 §3.I): *Show
 * dismissed* lists the dismissed entries with the pattern hiding each;
 * *Undo* removes it and focuses the restored entry, but only an entry the
 * change shows: one another pattern still hides takes no focus later.
 *
 * @module
 */
import { act, fireEvent, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  dismissButton,
  heading,
  openForm,
  type Outside,
  panel,
  renderPanel,
} from '@/test/unmappedPanel';

describe('undoing a dismissal', () => {
  it('lists dismissed entries with their pattern, and Undo brings them back', () => {
    const saved = renderPanel();
    fireEvent.click(dismissButton(openForm('Nightly')));
    const toggle = within(panel()).getByRole('button', {
      name: 'Show dismissed',
    });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(toggle).not.toHaveClass('bg-primary');
    expect(toggle.querySelector('svg')).toBeNull();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    // Pressed is filled and checked, unlike the ghost hover.
    expect(toggle).toHaveClass('bg-primary');
    expect(toggle.querySelector('svg')).not.toBeNull();
    const list = within(panel()).getByRole('list', { name: 'Dismissed runs' });
    expect(within(list).getByRole('link', { name: 'Nightly' })).toBeVisible();
    expect(
      within(list).getByText(
        'Dismissed by Repo or app acme/api, Workflow Nightly',
      ),
    ).toBeVisible();
    fireEvent.click(within(list).getByRole('button', { name: 'Undo' }));
    expect(saved.at(-1)?.unmappedDismissals).toEqual([]);
    // Focus goes to the restored entry's Dismiss… button.
    expect(document.activeElement).toHaveAccessibleName('Dismiss…');
    expect(document.activeElement?.closest('li')?.textContent).toContain(
      'Nightly',
    );
    expect(
      within(panel()).getByRole('link', { name: 'Nightly' }),
    ).toBeVisible();
    expect(
      within(panel()).queryByRole('list', { name: 'Dismissed runs' }),
    ).toBeNull();
  });

  it('moves focus on Undo only to an entry it shows', () => {
    const byBranch = { id: 'branch', branch: 'main' };
    const outside: Outside = {
      dismissals: [
        { id: 'workflow', where: 'acme/api', workflow: 'Nightly' },
        byBranch,
      ],
    };
    renderPanel(undefined, undefined, undefined, outside);
    fireEvent.click(
      within(panel()).getByRole('button', { name: 'Show dismissed' }),
    );
    fireEvent.click(within(panel()).getByRole('button', { name: 'Undo' }));
    // Still hidden, by the branch pattern.
    const list = within(panel()).getByRole('list', { name: 'Dismissed runs' });
    expect(
      within(list).getByText('Dismissed by Branch pattern main'),
    ).toBeVisible();
    heading().focus();
    // The branch pattern goes elsewhere: Nightly's Dismiss… mounts.
    act(() => {
      outside.replace?.([]);
    });
    expect(
      within(panel()).getByRole('link', { name: 'Nightly' }),
    ).toBeVisible();
    expect(document.activeElement).toBe(heading());
  });
});
