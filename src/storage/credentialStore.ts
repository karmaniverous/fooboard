/**
 * Credential secrets (spec.md C-5, C-6): GitHub tokens and AWS keys, keyed
 * by the credential id a dashboard references. A secret lives in local
 * storage only when the user ticks *Remember on this device*; otherwise it
 * is held in memory and gone when the tab closes. *Forget* removes it from
 * both. Copying a credential to another dashboard (C-1a) creates an
 * independent copy under a new id. Secrets never leave this module except
 * to the providers that use them.
 *
 * Subscribers hear which credential changed and whether what was read
 * with it must go (spec.md §3.1, §3.4, Decision 27): a replaced secret,
 * *Forget* (removing a credential and deleting a dashboard forget its
 * secrets) and unticking *Remember* drop its data; entering a first
 * secret, entering the same one again and ticking *Remember* don't.
 *
 * @module
 */
import { z } from 'zod';

import {
  KEY_PREFIX,
  type KeyValueStore,
  memoryStorage,
  readJson,
} from './keyValue';

const GithubSecretSchema = z.object({
  kind: z.literal('github'),
  token: z.string().min(1),
});
const AwsSecretSchema = z.object({
  kind: z.literal('aws'),
  accessKeyId: z.string().min(1),
  secretAccessKey: z.string().min(1),
});
const CredentialSecretSchema = z.discriminatedUnion('kind', [
  GithubSecretSchema,
  AwsSecretSchema,
]);
export type CredentialSecret = z.infer<typeof CredentialSecretSchema>;

/** Hears a change to credential `id`; `dropsData`: its data must go. */
type CredentialListener = (id: string, dropsData: boolean) => void;

const keyFor = (id: string): string => `${KEY_PREFIX}credential:${id}`;

export interface CredentialStore {
  get(id: string): CredentialSecret | undefined;
  /** Is this secret kept on the device (vs. this session only)? */
  isRemembered(id: string): boolean;
  set(id: string, secret: CredentialSecret, remember: boolean): void;
  /** *Forget*: remove from the device and the session. */
  forget(id: string): void;
  /** Copy `fromId`'s secret to `toId` as an independent copy. */
  copy(fromId: string, toId: string): void;
  /** Drop the session-only secrets (part of *Reset*). */
  clearSession(): void;
  /** Called after any change, so readers built from secrets can rebuild;
   * `dropsData` says whether what was read with the credential must go. */
  subscribe(listener: CredentialListener): () => void;
}

/** `device` is local storage; session secrets stay in this object. */
export function createCredentialStore(device: KeyValueStore): CredentialStore {
  let session = memoryStorage();
  const listeners = new Set<CredentialListener>();
  const changed = (id: string, dropsData: boolean): void => {
    for (const listener of listeners) listener(id, dropsData);
  };

  const read = (store: KeyValueStore, id: string) => {
    const parsed = CredentialSecretSchema.safeParse(
      readJson(store, keyFor(id)),
    );
    return parsed.success ? parsed.data : undefined;
  };

  const store: CredentialStore = {
    get: (id) => read(session, id) ?? read(device, id),
    isRemembered: (id) => read(device, id) !== undefined,
    set: (id, secret, remember) => {
      const value = JSON.stringify(CredentialSecretSchema.parse(secret));
      const before = store.get(id);
      const replaced = before !== undefined && JSON.stringify(before) !== value;
      const unremembered = !remember && store.isRemembered(id);
      // Exactly one home. Write the new home first, so a failed write (e.g.
      // storage quota) leaves the existing copy in place.
      (remember ? device : session).setItem(keyFor(id), value);
      (remember ? session : device).removeItem(keyFor(id));
      changed(id, replaced || unremembered);
    },
    forget: (id) => {
      // The session copy first, and subscribers told even if the device
      // refuses: a failed device removal must not keep a tab-only secret.
      session.removeItem(keyFor(id));
      try {
        device.removeItem(keyFor(id));
      } finally {
        changed(id, true);
      }
    },
    copy: (fromId, toId) => {
      const secret = store.get(fromId);
      if (!secret) throw new Error(`No secret stored for credential ${fromId}`);
      store.set(toId, { ...secret }, store.isRemembered(fromId));
    },
    clearSession: () => {
      session = memoryStorage();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
  return store;
}
