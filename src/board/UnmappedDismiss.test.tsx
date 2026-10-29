/**
 * Dismissing unmapped runs from the panel (spec 0.2.0 §3.I, Decisions 86
 * and 101): the inline *Dismiss…* form's presets fill its fields; each
 * field can be cleared; *Dismiss* is disabled, saying why, while none is
 * set; the form counts the entries its pattern matches; *Dismiss* saves
 * the pattern, hides what it matches and returns focus to the heading,
 * or, when no entry is left, tells its owner (who focuses the title);
 * Escape cancels to the *Dismiss…* button without closing the panel; one
 * form is open at a time; a refused save says *Not saved*. *Show
 * dismissed* and *Undo*: UnmappedUndo.test.tsx.
 *
 * @module
 */
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { choose } from '@/test/choose';
import {
  dismissButton,
  entry,
  field,
  heading,
  nightly,
  openForm,
  panel,
  renderPanel,
} from '@/test/unmappedPanel';

describe('dismissing an unmapped run', () => {
  it('fills the fields from the chosen preset, focus on the preset choice', () => {
    renderPanel();
    const form = openForm('Deploy API');
    const presets = within(form).getAllByRole('radio');
    expect(presets.map((p) => p.getAttribute('value'))).toEqual([
      'workflow',
      'branchHere',
      'branchesLike',
      'reason',
    ]);
    expect(document.activeElement).toBe(presets[0]);
    expect(within(form).getByRole('radiogroup')).toHaveAccessibleName(
      'Which runs to dismiss',
    );
    expect(dismissButton(form)).toHaveAccessibleName('Dismiss');
    expect(field(form, 'Repo or app')).toHaveValue('acme/api');
    expect(field(form, 'Workflow')).toHaveValue('Deploy API');
    expect(field(form, 'Branch pattern')).toHaveValue('');
    fireEvent.click(within(form).getByRole('radio', { name: /Branches like/ }));
    expect(field(form, 'Repo or app')).toHaveValue('');
    expect(field(form, 'Branch pattern')).toHaveValue('feature/*');
    expect(within(form).getByText(/Matches 1 of the 2/)).toBeVisible();
  });

  it('disables Dismiss, saying why, while no field is set', () => {
    renderPanel();
    const form = openForm('Deploy API');
    fireEvent.change(field(form, 'Repo or app'), { target: { value: '' } });
    fireEvent.change(field(form, 'Workflow'), { target: { value: '' } });
    expect(dismissButton(form)).toBeDisabled();
    expect(dismissButton(form)).toHaveAccessibleDescription(
      'Set at least one field',
    );
    fireEvent.change(field(form, 'Branch pattern'), {
      target: { value: '**' },
    });
    expect(dismissButton(form)).toBeEnabled();
    expect(within(form).getByText(/Matches 2 of the 2/)).toBeVisible();
  });

  it('counts only the entries shown, as the heading does', () => {
    renderPanel();
    fireEvent.click(dismissButton(openForm('Nightly')));
    const form = openForm('Deploy API');
    fireEvent.change(field(form, 'Repo or app'), { target: { value: '' } });
    fireEvent.change(field(form, 'Workflow'), { target: { value: '' } });
    fireEvent.change(field(form, 'Branch pattern'), {
      target: { value: '**' },
    });
    expect(heading()).toHaveTextContent('1 unmapped run, 1 dismissed');
    expect(
      within(form).getByText('Matches 1 of the 1 entry shown.'),
    ).toBeVisible();
  });

  it('saves the pattern, hides what it matches and focuses the heading', () => {
    const saved = renderPanel();
    const form = openForm('Deploy API');
    choose(within(form).getByRole('combobox'), 'no row rule matches');
    fireEvent.click(dismissButton(form));
    const [added] = saved.at(-1)?.unmappedDismissals ?? [];
    expect(added).toMatchObject({
      where: 'acme/api',
      workflow: 'Deploy API',
      reason: 'no-row-matches',
    });
    expect(Object.keys(added).sort()).toEqual([
      'id',
      'reason',
      'where',
      'workflow',
    ]);
    expect(added.id).not.toBe('');
    expect(
      within(panel()).queryByRole('link', { name: 'Deploy API' }),
    ).toBeNull();
    expect(screen.queryByRole('form')).toBeNull();
    expect(heading()).toHaveTextContent('1 unmapped run, 1 dismissed');
    expect(document.activeElement).toBe(heading());
  });

  it('tells its owner once the last entry is dismissed, and only then', () => {
    const emptied = vi.fn();
    renderPanel(undefined, undefined, emptied);
    fireEvent.click(dismissButton(openForm('Nightly')));
    expect(emptied).not.toHaveBeenCalled();
    fireEvent.click(dismissButton(openForm('Deploy API')));
    expect(emptied).toHaveBeenCalledTimes(1);
  });

  it('cancels on Escape back to Dismiss…, the panel still open; one form at a time', () => {
    renderPanel();
    openForm('Deploy API');
    const form = openForm('Nightly');
    expect(screen.getAllByRole('form')).toEqual([form]);
    fireEvent.keyDown(field(form, 'Workflow'), { key: 'Escape' });
    expect(screen.queryByRole('form')).toBeNull();
    expect(panel()).toBeVisible();
    expect(document.activeElement).toHaveAccessibleName('Dismiss…');
    expect(document.activeElement?.closest('li')?.textContent).toContain(
      'Nightly',
    );
  });

  it('says Not saved when the save is refused, the form left open', () => {
    renderPanel(undefined, () => {
      throw new Error('storage full');
    });
    const form = openForm('Deploy API');
    fireEvent.click(dismissButton(form));
    expect(within(form).getByText(/storage full/)).toBeVisible();
    expect(screen.getByRole('form')).toBe(form);
    expect(
      within(panel()).getByRole('link', { name: 'Deploy API' }),
    ).toBeVisible();
  });
});

describe('the presets’ guards', () => {
  it('offers no branch preset without a branch, the field empty', () => {
    renderPanel([entry(3, { branch: null }), nightly]);
    const form = openForm('Deploy API');
    expect(
      within(form)
        .getAllByRole('radio')
        .map((p) => p.getAttribute('value')),
    ).toEqual(['workflow', 'reason']);
    expect(field(form, 'Branch pattern')).toHaveValue('');
  });

  it('hides Branches like this for a one-segment branch', () => {
    renderPanel();
    const form = openForm('Nightly');
    expect(
      within(form).queryByRole('radio', { name: /Branches like/ }),
    ).toBeNull();
  });
});
