/**
 * Tests for updating a board by import (spec.md §3.8): the sender shares
 * a dashboard, changes it and shares it again; the re-export keeps the
 * dashboard's id, so on the receiving device the import offers *Replace
 * mine* (saying it overwrites local changes), updates the dashboard in
 * place with its ids, and leaves the secrets remembered there usable.
 *
 * @module
 */
import { cleanup, fireEvent, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Dashboard } from '@/domain/config/dashboard';
import { type AppStores, createAppStores } from '@/storage';
import { memoryStorage } from '@/storage/keyValue';
import { choose } from '@/test/choose';
import {
  box,
  dialog,
  importNow,
  payloadOf,
  renderImport,
  where,
} from '@/test/renderImport';
import { shareBoard } from '@/test/shareBoard';

import { makeShare } from '../exportShare';
import { REPLACE_MINE_NOTE, TAB_ONLY_NOTE } from './shareWords';

const gh = { kind: 'github', token: 'ghp_sender' } as const;
const dashboardsOf = (stores: AppStores): Dashboard[] => {
  const loaded = stores.config.load();
  return loaded.kind === 'ok' ? loaded.root.dashboards : [];
};

/** The sender's device, holding `board` and its remembered secret. */
function sender(board: Dashboard): AppStores {
  const stores = createAppStores(memoryStorage());
  stores.config.saveDashboard(board);
  stores.credentials.set('gh-org', gh, true);
  return stores;
}

/** The sender's share of everything saved, with credentials or not. */
const shareFrom = async (stores: AppStores, credentials: boolean) =>
  payloadOf(
    await makeShare(
      dashboardsOf(stores),
      credentials ? { include: true, passphrase: null } : { include: false },
      (id) => stores.credentials.get(id),
    ),
  );

describe('updating a board by importing it again', () => {
  it.each([
    ['without credentials', false],
    ['with the same credentials', true],
  ])(
    'replaces it in place, keeping its ids and remembered secrets (%s)',
    async (_, withCredentials) => {
      const first = shareBoard();
      const from = sender(first);
      const device = memoryStorage();

      // The first import, remembered on the receiving device.
      renderImport(await shareFrom(from, true), createAppStores(device));
      fireEvent.click(box('Remember on this device'));
      await importNow();
      cleanup();
      const here = createAppStores(device);
      expect(dashboardsOf(here).map((d) => d.id)).toEqual([first.id]);
      expect(here.credentials.isRemembered('gh-org')).toBe(true);
      // A local change the update will overwrite.
      here.config.saveDashboard({ ...first, name: 'Renamed here' });

      // The sender changes the board and shares it again: same id.
      from.config.saveDashboard({ ...first, name: 'Northwind v2' });
      const update = await shareFrom(from, withCredentials);
      expect(update.kind === 'text' && JSON.parse(update.text)).toMatchObject({
        dashboards: [{ id: first.id, name: 'Northwind v2' }],
      });

      renderImport(update, createAppStores(device));
      expect(
        within(dialog()).getByRole('combobox', {
          name: 'Northwind v2: already here',
        }),
      ).toHaveTextContent('Replace mine');
      expect(within(dialog()).getByText(REPLACE_MINE_NOTE)).toBeVisible();
      expect(
        within(dialog()).getByRole('combobox', {
          name: 'Northwind v2: already here',
        }),
      ).toHaveAccessibleDescription(REPLACE_MINE_NOTE);
      expect(within(dialog()).queryByText(TAB_ONLY_NOTE) !== null).toBe(
        withCredentials,
      );
      await importNow();
      expect(where()).toBe(`/d/${first.id}`);

      // After a reload: one dashboard, updated, same ids, secret still kept.
      const after = createAppStores(device);
      const [updated, ...rest] = dashboardsOf(after);
      expect(rest).toEqual([]);
      expect(updated).toEqual({ ...first, name: 'Northwind v2' });
      expect(updated.credentials.map((c) => c.id)).toEqual(
        first.credentials.map((c) => c.id),
      );
      expect(after.credentials.get('gh-org')).toEqual(gh);
      expect(after.credentials.isRemembered('gh-org')).toBe(true);
    },
  );

  it('says nothing about replacing when nothing is here', async () => {
    renderImport(await shareFrom(sender(shareBoard()), false));
    expect(within(dialog()).queryByText(REPLACE_MINE_NOTE)).toBeNull();
  });

  it('stops saying it once Keep as a copy is chosen', async () => {
    const board = shareBoard();
    const here = createAppStores(memoryStorage());
    here.config.saveDashboard(board);
    renderImport(await shareFrom(sender(board), false), here);
    const already = () =>
      within(dialog()).getByRole('combobox', {
        name: `${board.name}: already here`,
      });
    expect(within(dialog()).getByText(REPLACE_MINE_NOTE)).toBeVisible();
    expect(already()).toHaveAccessibleDescription(REPLACE_MINE_NOTE);
    choose(already(), 'Keep as a copy');
    expect(within(dialog()).queryByText(REPLACE_MINE_NOTE)).toBeNull();
    expect(already()).not.toHaveAttribute('aria-describedby');
  });
});
