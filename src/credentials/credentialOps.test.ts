/**
 * Tests for two-store credential operations: a failed configuration write
 * leaves no orphaned secret, removal never loses a secret before the
 * configuration is saved, duplicating works with missing secrets, and a
 * secret that can't be cleared is reported with how to remove it.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { type Dashboard, DashboardSchema } from '@/domain/config/dashboard';
import { duplicateDashboard } from '@/editors/edit';
import {
  createCredentialStore,
  type CredentialStore,
} from '@/storage/credentialStore';
import { type KeyValueStore, memoryStorage } from '@/storage/keyValue';

import {
  addWithSecret,
  copyCredential,
  deleteWithSecrets,
  removeWithSecret,
  saveDuplicate,
} from './credentialOps';

const failingSave = () => {
  throw new Error('quota exceeded');
};
const okSave = () => undefined;
const secret = { kind: 'github' as const, token: '***' };

/** Every credential id holding a secret, on device or in the tab. */
const storedIds = (store: CredentialStore, ids: string[]) =>
  ids.filter((id) => store.get(id) !== undefined);

const withGh = (store: CredentialStore) => {
  store.set('gh', secret, true);
  return DashboardSchema.parse({
    id: 'd',
    name: 'D',
    credentials: [{ id: 'gh', kind: 'github', label: 'gh' }],
    defaultCredentials: { github: 'gh' },
  });
};

describe('credential operations', () => {
  it('leaves no orphaned secret when saving an added or copied credential fails', () => {
    const device = memoryStorage();
    const store = createCredentialStore(device);
    const d = withGh(store);
    expect(() =>
      addWithSecret(
        store,
        failingSave,
        d,
        { kind: 'github', label: 'x' },
        secret,
        true,
      ),
    ).toThrow('quota exceeded');
    expect(() =>
      copyCredential(store, failingSave, d, {
        id: 'gh',
        kind: 'github',
        label: 'gh',
      }),
    ).toThrow('quota exceeded');
    expect(device.keys().filter((k) => k.includes('credential:'))).toEqual([
      'fooboard:credential:gh',
    ]);
  });

  it('keeps the secret when removing a credential fails to save', () => {
    const store = createCredentialStore(memoryStorage());
    const d = withGh(store);
    expect(() => removeWithSecret(store, failingSave, d, 'gh')).toThrow();
    expect(store.get('gh')).toEqual(secret);
    expect(removeWithSecret(store, okSave, d, 'gh').credentials).toEqual([]);
    expect(store.get('gh')).toBeUndefined();
  });

  it('keeps secrets when deleting a dashboard fails to save', () => {
    const store = createCredentialStore(memoryStorage());
    const d = withGh(store);
    expect(() => {
      deleteWithSecrets(store, failingSave, d);
    }).toThrow();
    expect(store.get('gh')).toEqual(secret);
    deleteWithSecrets(store, okSave, d);
    expect(store.get('gh')).toBeUndefined();
  });

  it('duplicates after Forget, re-keying metadata without copying a secret', () => {
    const store = createCredentialStore(memoryStorage());
    const d = withGh(store);
    store.forget('gh');
    const copy = saveDuplicate(store, okSave, (rekey) =>
      duplicateDashboard(d, 'd2', 'D (copy)', rekey),
    );
    expect(copy.credentials).toHaveLength(1);
    const ref = copy.credentials[0];
    expect(ref).toMatchObject({ kind: 'github', label: 'gh' });
    expect(ref.id).not.toBe('gh');
    expect(copy.defaultCredentials.github).toBe(ref.id);
    expect(store.get(ref.id)).toBeUndefined();
  });

  it('removes copied secrets when saving a duplicate fails', () => {
    const store = createCredentialStore(memoryStorage());
    const d = withGh(store);
    let newId = '';
    expect(() =>
      saveDuplicate(store, failingSave, (rekey) =>
        duplicateDashboard(d, 'd2', 'D (copy)', (old) => (newId = rekey(old))),
      ),
    ).toThrow('quota exceeded');
    expect(storedIds(store, [newId])).toEqual([]);
    expect(store.get('gh')).toEqual(secret);
  });
});

/** A device store that refuses to remove anything, so secrets can't be
 * forgotten. */
const stuck = (): KeyValueStore => ({
  ...memoryStorage(),
  removeItem: () => {
    throw new Error('storage refused the removal');
  },
});

describe('credential operations whose cleanup fails', () => {
  it.each<[string, (store: CredentialStore, d: Dashboard) => unknown]>([
    [
      'adding, when the save fails',
      (store, d) =>
        addWithSecret(
          store,
          failingSave,
          d,
          { kind: 'github', label: 'x' },
          secret,
          true,
        ),
    ],
    ['removing', (store, d) => removeWithSecret(store, okSave, d, 'gh')],
    [
      'duplicating, when the save fails',
      (store, d) =>
        saveDuplicate(store, failingSave, (rekey) =>
          duplicateDashboard(d, 'd2', 'D (copy)', rekey),
        ),
    ],
    [
      'deleting a dashboard',
      (store, d) => {
        deleteWithSecrets(store, okSave, d);
      },
    ],
  ])('says how to remove the leftovers after %s', (_label, run) => {
    const store = createCredentialStore(stuck());
    const d = withGh(store);
    expect(() => run(store, d)).toThrow(
      /clear this site.s data in your browser.s settings/,
    );
  });
});
