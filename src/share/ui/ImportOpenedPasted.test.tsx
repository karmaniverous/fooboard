/**
 * Tests that a share link opened and the same link pasted into the import
 * dialog have the same effect (spec.md §3.8, Decision 69): the same
 * dashboards listed, the same passphrase step, and the same import
 * result. A link is opened two ways: in a new page (`takeShareLink` on the
 * window before rendering, as `main.tsx` does) and into an open tab (a
 * `hashchange`); it is pasted, between spaces, into *Or a fooboard link*.
 * The dialog opened by a link shows no file or link field, which is the
 * one thing that differs, so the comparison leaves the fields out.
 *
 * @module
 */
import {
  act,
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { createDashboard } from '@/domain/config/presets';
import type { AppStores } from '@/storage';
import { renderImport, savedIds, where } from '@/test/renderImport';
import { shareBoard } from '@/test/shareBoard';

import { buildEnvelope } from '../envelope';
import { shareLink, takeShareLink } from '../link';
import { encryptSecrets } from '../secrets';

const board = shareBoard();
const second = createDashboard('Second board');
const gh = { 'gh-org': { kind: 'github', token: 'ghp_shared' } } as const;
const dialog = () => screen.getByRole('dialog', { name: 'Import dashboards' });

afterEach(() => {
  window.history.replaceState(null, '', '/');
});

type Way = 'opened in a new page' | 'opened in an open tab' | 'pasted';
const WAYS: Way[] = ['opened in a new page', 'opened in an open tab', 'pasted'];

/** Bring `link` into the import dialog `way`. */
async function bring(link: string, way: Way): Promise<AppStores> {
  const fragment = new URL(link).hash;
  if (way === 'opened in a new page') {
    window.history.replaceState(null, '', `/${fragment}`);
    const taken = takeShareLink(window, '/');
    // Opening clears the fragment; pasting has none to clear.
    expect(window.location.hash).toBe('');
    return renderImport(taken);
  }
  const stores = renderImport();
  if (way === 'opened in an open tab') {
    window.location.hash = fragment;
    await waitFor(() => {
      expect(dialog()).toBeVisible();
    });
    expect(window.location.hash).toBe('');
  } else {
    fireEvent.click(screen.getByRole('button', { name: 'Open import' }));
    fireEvent.change(within(dialog()).getByLabelText('Or a fooboard link'), {
      target: { value: `  ${link}  ` },
    });
  }
  return stores;
}

/** What the dialog shows, leaving out the file and link fields. */
function shown() {
  const d = dialog();
  const passphrase = within(d).queryByLabelText('Passphrase');
  const importButton = within(d).queryByRole('button', { name: 'Import' });
  return {
    text: within(d)
      .queryAllByText(/^This link|^Ask whoever/)
      .map((p) => p.textContent),
    alert: within(d).queryByRole('alert')?.textContent ?? null,
    listed: within(d)
      .queryAllByRole('checkbox')
      .map((c) => [
        // Each checkbox is named by its visible label.
        document.querySelector(`label[for="${c.id}"]`)?.textContent,
        c.getAttribute('aria-checked'),
      ]),
    passphrase: passphrase?.getAttribute('type') ?? null,
    importEnabled: importButton ? !importButton.hasAttribute('disabled') : null,
  };
}

const importNow = async () => {
  await act(async () => {
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Import' }));
    await Promise.resolve();
  });
};

/**
 * Each way's dialog, and what importing (with `passphrase`) left once the
 * app reached `opens`, where the import should open (the route changes
 * after the dialog closes, so waiting for the close alone races it).
 */
async function each(
  link: string,
  { passphrase, opens }: { passphrase?: string; opens?: string } = {},
) {
  const seen = [];
  for (const way of WAYS) {
    const stores = await bring(link, way);
    const before = shown();
    let after = null;
    if (before.listed.length) {
      if (passphrase)
        fireEvent.change(within(dialog()).getByLabelText('Passphrase'), {
          target: { value: passphrase },
        });
      await importNow();
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(where()).toBe(opens);
      });
      after = {
        saved: savedIds(stores),
        secret: stores.credentials.get('gh-org') ?? null,
        remembered: stores.credentials.isRemembered('gh-org'),
        at: where(),
      };
    }
    seen.push({ way, before, after });
    cleanup();
    window.history.replaceState(null, '', '/');
  }
  // Every way shows and leaves what the first does.
  const first = { ...seen[0], way: 'any' };
  expect(seen.map((s) => ({ ...s, way: 'any' }))).toEqual(
    WAYS.map(() => first),
  );
  return first;
}

describe('a share link opened or pasted', () => {
  it('lists the same dashboards and imports them the same way', async () => {
    const { before, after } = await each(
      shareLink(
        buildEnvelope([board, second], { encrypted: false, secrets: gh }),
        'https://fooboard.dev',
      ),
      { opens: '/' },
    );
    expect(before.text).toEqual([
      'This link holds 2 dashboards and credentials.',
    ]);
    expect(before.listed).toEqual([
      ['Select all', 'true'],
      [board.name, 'true'],
      [second.name, 'true'],
      ['Import its credentials', 'true'],
      ['Remember on this device', 'false'],
    ]);
    expect(before.passphrase).toBeNull();
    expect(after).toEqual({
      saved: [board.id, second.id],
      secret: gh['gh-org'],
      remembered: false,
      at: '/',
    });
  });

  it('asks for the passphrase the same way, and imports what it opens', async () => {
    const { before, after } = await each(
      shareLink(
        buildEnvelope([board], await encryptSecrets(gh, 'opensesame', 1_000)),
        'https://fooboard.dev',
      ),
      { passphrase: 'opensesame', opens: `/d/${board.id}` },
    );
    expect(before.text).toEqual([
      'This link holds 1 dashboard and credentials encrypted with a passphrase.',
    ]);
    expect(before.passphrase).toBe('password');
    expect(before.importEnabled).toBe(false);
    expect(after).toEqual({
      saved: [board.id],
      secret: gh['gh-org'],
      remembered: false,
      at: `/d/${board.id}`,
    });
  });

  it('refuses a damaged link the same way', async () => {
    const { before, after } = await each('https://fooboard.dev/#b=%E2%98%83');
    expect(before.alert).toBe(
      "This link isn't a fooboard board, or it's damaged.",
    );
    expect(before.text).toEqual([
      "This link isn't a fooboard board, or it's damaged.",
      'Ask whoever sent it for a new link, or for a file.',
    ]);
    expect(before.listed).toEqual([]);
    expect(after).toBeNull();
  });
});
