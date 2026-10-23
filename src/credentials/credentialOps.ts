/**
 * Credential operations that touch two stores: the secret store and the
 * saved configuration. Each orders its writes so a failure never leaves
 * an orphaned secret (stored, but referenced by no dashboard) or a saved
 * reference whose secret was already thrown away:
 * - adding or copying writes the secret, then the configuration, and
 *   forgets the new secret if the configuration write fails;
 * - removing writes the configuration first, then forgets the secret.
 *
 * Errors propagate to the caller (which reports them); cleanup failures
 * are attached to the error, never the secret itself, and the message says
 * how to remove what was left (`LEFTOVER_SECRETS_HINT`).
 *
 * @module
 */
import type { CredentialRef } from '@/domain/config/credentials';
import type { Dashboard } from '@/domain/config/dashboard';
import type {
  CredentialSecret,
  CredentialStore,
} from '@/storage/credentialStore';

import {
  addCredential,
  newCredentialId,
  removeCredential,
} from './dashboardCredentials';

/** How to remove secrets a failed cleanup left in this browser: *Reset*
 * (spec.md §3.9), which clears them from storage and from every open
 * tab's memory. Ends every cleanup-failure message. */
const LEFTOVER_SECRETS_HINT =
  "Use Reset, in the menu, to clear them; it removes all of fooboard's data from this browser, dashboards included.";

/** Forget `ids`, collecting (not throwing) failures. */
function forgetAll(store: CredentialStore, ids: readonly string[]): unknown[] {
  const failures: unknown[] = [];
  for (const id of ids) {
    try {
      store.forget(id);
    } catch (err) {
      failures.push(err);
    }
  }
  return failures;
}

/** Run `save`; on failure, forget the secrets written for it and rethrow. */
function saveOrRollBack(
  store: CredentialStore,
  newIds: readonly string[],
  save: () => void,
): void {
  try {
    save();
  } catch (err) {
    const cleanup = forgetAll(store, newIds);
    if (cleanup.length > 0) {
      throw new AggregateError(
        [err, ...cleanup],
        `Saving failed, and some new credentials could not be removed from this browser. ${LEFTOVER_SECRETS_HINT}`,
        { cause: err },
      );
    }
    throw err;
  }
}

/** Add a credential with its secret; returns the saved dashboard. */
export function addWithSecret(
  store: CredentialStore,
  save: (dashboard: Dashboard) => void,
  dashboard: Dashboard,
  ref: Omit<CredentialRef, 'id'>,
  secret: CredentialSecret,
  remember: boolean,
): Dashboard {
  const id = newCredentialId();
  store.set(id, secret, remember);
  const next = addCredential(dashboard, { ...ref, id });
  saveOrRollBack(store, [id], () => {
    save(next);
  });
  return next;
}

/** Copy another dashboard's credential (an independent copy). */
export function copyCredential(
  store: CredentialStore,
  save: (dashboard: Dashboard) => void,
  dashboard: Dashboard,
  source: CredentialRef,
): Dashboard {
  const id = newCredentialId();
  store.copy(source.id, id);
  const next = addCredential(dashboard, { ...source, id });
  saveOrRollBack(store, [id], () => {
    save(next);
  });
  return next;
}

/** Remove a credential: the configuration first, then its secret. */
export function removeWithSecret(
  store: CredentialStore,
  save: (dashboard: Dashboard) => void,
  dashboard: Dashboard,
  id: string,
): Dashboard {
  const next = removeCredential(dashboard, id);
  save(next);
  const failures = forgetAll(store, [id]);
  if (failures.length > 0) {
    throw new AggregateError(
      failures,
      `The credential was removed from the dashboard, but its secret could not be cleared from this browser. ${LEFTOVER_SECRETS_HINT}`,
    );
  }
  return next;
}

/**
 * Save a duplicate built with fresh credential ids. Secrets present on
 * this device are copied; missing ones (tab-only after a reload, or
 * forgotten) are simply left to be entered again.
 */
export function saveDuplicate(
  store: CredentialStore,
  save: (dashboard: Dashboard) => void,
  build: (rekey: (oldId: string) => string) => Dashboard,
): Dashboard {
  const copied: string[] = [];
  try {
    const copy = build((oldId) => {
      const id = newCredentialId();
      if (store.get(oldId) !== undefined) {
        store.copy(oldId, id);
        copied.push(id);
      }
      return id;
    });
    save(copy);
    return copy;
  } catch (err) {
    const cleanup = forgetAll(store, copied);
    if (cleanup.length > 0) {
      throw new AggregateError(
        [err, ...cleanup],
        `Duplicating failed, and some copied credentials could not be removed from this browser. ${LEFTOVER_SECRETS_HINT}`,
        { cause: err },
      );
    }
    throw err;
  }
}

/** Delete a dashboard: the configuration first, then its secrets. */
export function deleteWithSecrets(
  store: CredentialStore,
  remove: (id: string) => void,
  dashboard: Dashboard,
): void {
  remove(dashboard.id);
  const failures = forgetAll(
    store,
    dashboard.credentials.map((c) => c.id),
  );
  if (failures.length > 0) {
    throw new AggregateError(
      failures,
      `The dashboard was deleted, but some of its credentials could not be cleared from this browser. ${LEFTOVER_SECRETS_HINT}`,
    );
  }
}
