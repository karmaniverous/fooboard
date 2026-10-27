/**
 * Tests for the import's question about a secret that differs (spec.md
 * §3.8, Decision 70): one labelled radio group per such credential, named
 * by its label, with nothing chosen and neither value shown; *Import*
 * disabled, saying why, until every one is answered; *Keep yours* leaving
 * this device's secret and its remembered state alone; *Use the share's*
 * following *Remember on this device*; no question for an identical
 * secret, a credential new here or a copy.
 *
 * @module
 */
import { fireEvent, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { choose } from '@/test/choose';
import { box, dialog, importNow, renderImport } from '@/test/renderImport';
import {
  answer,
  AWS_MINE,
  AWS_QUESTION,
  AWS_THEIRS,
  deviceWith,
  GH_QUESTION,
  importButton,
  MINE,
  plainShare,
  question,
  questions,
  savedNames,
  THEIRS,
} from '@/test/secretImport';

import { ANSWER_TO_IMPORT } from './shareWords';

describe('a secret in the share that differs from this device', () => {
  it('raises its question, unanswered, and blocks Import until answered', () => {
    renderImport(
      plainShare({ 'gh-org': THEIRS }),
      deviceWith({ 'gh-org': MINE }),
    );
    expect(questions()).toHaveLength(1);
    const radios = ['Keep yours', "Use the share's"].map((name) =>
      within(question(GH_QUESTION)).getByRole('radio', { name }),
    );
    for (const r of radios) expect(r).not.toBeChecked();
    expect(importButton()).toBeDisabled();
    expect(importButton()).toHaveAccessibleDescription(ANSWER_TO_IMPORT);
    // Neither value is shown.
    expect(dialog().textContent).not.toMatch(/ghp_/);
    answer(GH_QUESTION, "Use the share's");
    expect(importButton()).toBeEnabled();
    expect(importButton()).not.toHaveAttribute('aria-describedby');
    expect(within(dialog()).queryByText(ANSWER_TO_IMPORT)).toBeNull();
  });

  it('asks once per differing credential and waits for every answer', () => {
    renderImport(
      plainShare({ 'gh-org': THEIRS, 'aws-prod': AWS_THEIRS }),
      deviceWith({ 'gh-org': MINE, 'aws-prod': AWS_MINE }),
    );
    expect(questions()).toEqual([
      question(GH_QUESTION),
      question(AWS_QUESTION),
    ]);
    answer(GH_QUESTION, 'Keep yours');
    expect(importButton()).toBeDisabled();
    answer(AWS_QUESTION, "Use the share's");
    expect(importButton()).toBeEnabled();
  });

  it.each([
    ['remembered', true],
    ['kept for this tab', false],
  ])(
    'keeps yours, %s, untouched whatever Remember says',
    async (_, remembered) => {
      const stores = deviceWith({ 'gh-org': MINE }, remembered);
      renderImport(plainShare({ 'gh-org': THEIRS }), stores);
      fireEvent.click(box('Remember on this device'));
      answer(GH_QUESTION, 'Keep yours');
      await importNow();
      expect(savedNames(stores)).toEqual(['Northwind v2']);
      expect(stores.credentials.get('gh-org')).toEqual(MINE);
      expect(stores.credentials.isRemembered('gh-org')).toBe(remembered);
    },
  );

  it.each([
    ['ticked', true],
    ['unticked', false],
  ])(
    "uses the share's, following Remember on this device (%s)",
    async (_, remember) => {
      const stores = deviceWith({ 'gh-org': MINE });
      renderImport(plainShare({ 'gh-org': THEIRS }), stores);
      if (remember) fireEvent.click(box('Remember on this device'));
      answer(GH_QUESTION, "Use the share's");
      await importNow();
      expect(stores.credentials.get('gh-org')).toEqual(THEIRS);
      expect(stores.credentials.isRemembered('gh-org')).toBe(remember);
    },
  );

  it('asks nothing for an identical secret or a credential new here', async () => {
    const stores = deviceWith({ 'gh-org': MINE });
    renderImport(
      plainShare({ 'gh-org': { ...MINE }, 'aws-prod': AWS_THEIRS }),
      stores,
    );
    expect(questions()).toEqual([]);
    expect(importButton()).toBeEnabled();
    await importNow();
    expect(stores.credentials.get('gh-org')).toEqual(MINE);
    expect(stores.credentials.isRemembered('gh-org')).toBe(true);
    expect(stores.credentials.get('aws-prod')).toEqual(AWS_THEIRS);
  });

  it('never asks for a copy, which gets new ids', async () => {
    const stores = deviceWith({ 'gh-org': MINE });
    renderImport(plainShare({ 'gh-org': THEIRS }), stores);
    expect(questions()).toHaveLength(1);
    choose(
      within(dialog()).getByRole('combobox', {
        name: 'Northwind v2: already here',
      }),
      'Keep as a copy',
    );
    expect(questions()).toEqual([]);
    await importNow();
    expect(stores.credentials.get('gh-org')).toEqual(MINE);
    const loaded = stores.config.load();
    const copy = loaded.kind === 'ok' ? loaded.root.dashboards[1] : undefined;
    const ghId = copy?.credentials.find((c) => c.kind === 'github')?.id;
    expect(ghId).not.toBe('gh-org');
    expect(ghId && stores.credentials.get(ghId)).toEqual(THEIRS);
  });
});
