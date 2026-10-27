/**
 * Tests for when the import asks about a secret that differs (spec.md
 * §3.8, Decision 70): only while *Import its credentials* is ticked
 * (unticking drops the questions and their answers); for encrypted
 * credentials, only once the passphrase has opened them; and Cancel or
 * Escape imports nothing, answered or not.
 *
 * @module
 */
import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { box, dialog, importNow, renderImport } from '@/test/renderImport';
import {
  answer,
  deviceWith,
  encryptedShare,
  GH_QUESTION,
  importButton,
  MINE,
  plainShare,
  question,
  questions,
  savedNames,
  THEIRS,
} from '@/test/secretImport';
import { shareBoard } from '@/test/shareBoard';

describe('when the import asks about a differing secret', () => {
  it('drops the questions, and their answers, when its credentials are unticked', async () => {
    const stores = deviceWith({ 'gh-org': MINE });
    renderImport(plainShare({ 'gh-org': THEIRS }), stores);
    answer(GH_QUESTION, "Use the share's");
    fireEvent.click(box('Import its credentials'));
    expect(questions()).toEqual([]);
    expect(importButton()).toBeEnabled();
    fireEvent.click(box('Import its credentials'));
    for (const r of within(question(GH_QUESTION)).getAllByRole('radio'))
      expect(r).not.toBeChecked();
    expect(importButton()).toBeDisabled();
    fireEvent.click(box('Import its credentials'));
    await importNow();
    expect(savedNames(stores)).toEqual(['Northwind v2']);
    expect(stores.credentials.get('gh-org')).toEqual(MINE);
  });

  it.each([
    [
      'Cancel',
      () => {
        fireEvent.click(
          within(dialog()).getByRole('button', { name: 'Cancel' }),
        );
      },
    ],
    [
      'Escape',
      () => {
        fireEvent.keyDown(dialog(), { key: 'Escape' });
      },
    ],
  ])('imports nothing on %s', (_, leave) => {
    const stores = deviceWith({ 'gh-org': MINE });
    renderImport(plainShare({ 'gh-org': THEIRS }), stores);
    answer(GH_QUESTION, "Use the share's");
    leave();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(savedNames(stores)).toEqual([shareBoard().name]);
    expect(stores.credentials.get('gh-org')).toEqual(MINE);
    expect(stores.credentials.isRemembered('gh-org')).toBe(true);
  });

  it('compares encrypted credentials only once the passphrase opens them', async () => {
    const stores = deviceWith({ 'gh-org': MINE });
    renderImport(
      await encryptedShare({ 'gh-org': THEIRS }, 'opensesame'),
      stores,
    );
    expect(questions()).toEqual([]);
    fireEvent.change(within(dialog()).getByLabelText('Passphrase'), {
      target: { value: 'opensesame' },
    });
    expect(questions()).toEqual([]);
    expect(importButton()).toBeEnabled();
    await importNow();
    // The first Import opened them and stopped to ask, writing nothing.
    await waitFor(() => {
      expect(questions()).toHaveLength(1);
    });
    expect(savedNames(stores)).toEqual([shareBoard().name]);
    expect(importButton()).toBeDisabled();
    expect(
      within(question(GH_QUESTION)).getByRole('radio', { name: 'Keep yours' }),
    ).toHaveFocus();
    answer(GH_QUESTION, "Use the share's");
    await importNow();
    await waitFor(() => {
      expect(stores.credentials.get('gh-org')).toEqual(THEIRS);
    });
    expect(savedNames(stores)).toEqual(['Northwind v2']);
  });

  it('drops the questions when the passphrase changes', async () => {
    const stores = deviceWith({ 'gh-org': MINE });
    renderImport(
      await encryptedShare({ 'gh-org': THEIRS }, 'opensesame'),
      stores,
    );
    const field = within(dialog()).getByLabelText('Passphrase');
    fireEvent.change(field, { target: { value: 'opensesame' } });
    await importNow();
    await waitFor(() => {
      expect(questions()).toHaveLength(1);
    });
    act(() => {
      fireEvent.change(field, { target: { value: 'opensesame!' } });
    });
    expect(questions()).toEqual([]);
    expect(stores.credentials.get('gh-org')).toEqual(MINE);
  });
});
