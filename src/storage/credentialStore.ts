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
 * Subscribers hear every change, even one the device refuses to finish,
 * and a refusal to remove a secret from the device says how to clear it
 * (`LEFTOVER_SECRETS_HINT`; fooboard#21).
 *
 * A secret this tab keeps for itself (a session copy) is the one it reads
 * with, and it is not remembered here, even if the device still holds a
 * copy it couldn't remove or another tab remembered since: so this tab
 * neither shows it as remembered nor keeps at rest what it read with it.
 *
 * @module
 */
import { z } from 'zod';

import { fingerprintOf } from '@/lib/fingerprint';

import {
  KEY_PREFIX,
  type KeyValueStore,
  memoryStorage,
  readJson,
} from './keyValue';
import { LEFTOVER_SECRETS_HINT } from './leftoverSecrets';

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
  /** Is the secret this tab reads with kept on the device (vs. this
   * tab only)? */
  isRemembered(id: string): boolean;
  /** The fingerprint of the secret a read uses now (the session's, else
   * the device's). */
  fingerprint(id: string): string | undefined;
  /** The fingerprint of the remembered secret (`isRemembered`), if any:
   * only what was read with it may be kept at rest (Decision 27). */
  rememberedFingerprint(id: string): string | undefined;
  /** Keep `secret` on the device or for this tab only. Throws, with
   * `LEFTOVER_SECRETS_HINT`, if the device refuses to remove its copy;
   * the secret is then this tab's all the same. */
  set(id: string, secret: CredentialSecret, remember: boolean): void;
  /** *Forget*: remove from the device and the session. Throws, with
   * `LEFTOVER_SECRETS_HINT`, if the device refuses. */
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
  /** The device's copy, unless this tab keeps a secret for itself. */
  const remembered = (id: string) =>
    read(session, id) === undefined ? read(device, id) : undefined;
  /** Remove the device's copy; a refusal says how to clear it. */
  const removeFromDevice = (id: string, what: string): void => {
    try {
      device.removeItem(keyFor(id));
    } catch (err) {
      throw new Error(
        `This browser would not remove ${what} from this device. ${LEFTOVER_SECRETS_HINT}`,
        { cause: err },
      );
    }
  };

  const store: CredentialStore = {
    get: (id) => read(session, id) ?? read(device, id),
    isRemembered: (id) => remembered(id) !== undefined,
    fingerprint: (id) => fingerprintOf(store.get(id)),
    rememberedFingerprint: (id) => fingerprintOf(remembered(id)),
    set: (id, secret, remember) => {
      const value = JSON.stringify(CredentialSecretSchema.parse(secret));
      const before = store.get(id);
      const replaced = before !== undefined && JSON.stringify(before) !== value;
      // Any device copy, this tab's or another's, goes with its data.
      const unremembered = !remember && read(device, id) !== undefined;
      // Exactly one home. Write the new home first, so a failed write (e.g.
      // storage quota) leaves the existing copy in place.
      if (remember) {
        device.setItem(keyFor(id), value);
        session.removeItem(keyFor(id));
        changed(id, replaced);
        return;
      }
      session.setItem(keyFor(id), value);
      // Subscribers hear it even if the device refuses (fooboard#21).
      try {
        removeFromDevice(id, "the secret's stored copy");
      } finally {
        changed(id, replaced || unremembered);
      }
    },
    forget: (id) => {
      // The session copy first, and subscribers told even if the device
      // refuses: a failed device removal must not keep a tab-only secret.
      session.removeItem(keyFor(id));
      try {
        removeFromDevice(id, 'the secret');
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
