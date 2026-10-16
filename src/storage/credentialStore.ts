/**
 * Credential secrets (spec.md C-5, C-6): GitHub tokens and AWS keys, keyed
 * by the credential id a dashboard references. A secret lives in local
 * storage only when the user ticks *Remember on this device*; otherwise it
 * is held in memory and gone when the tab closes. *Forget* removes it from
 * both. Copying a credential to another dashboard (C-1a) creates an
 * independent copy under a new id. Secrets never leave this module except
 * to the providers that use them.
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
  /** Called after any change, so readers built from secrets can rebuild. */
  subscribe(listener: (id: string) => void): () => void;
}

/** `device` is local storage; session secrets stay in this object. */
export function createCredentialStore(device: KeyValueStore): CredentialStore {
  let session = memoryStorage();
  const listeners = new Set<(id: string) => void>();
  const changed = (id: string): void => {
    for (const listener of listeners) listener(id);
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
      // Exactly one home. Write the new home first, so a failed write (e.g.
      // storage quota) leaves the existing copy in place.
      (remember ? device : session).setItem(keyFor(id), value);
      (remember ? session : device).removeItem(keyFor(id));
      changed(id);
    },
    forget: (id) => {
      device.removeItem(keyFor(id));
      session.removeItem(keyFor(id));
      changed(id);
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
