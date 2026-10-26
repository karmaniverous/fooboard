/**
 * Apply an import plan (spec.md §3.8): the configuration first, so a
 * refused save (unreadable stored data, storage quota) writes nothing at
 * all; then the imported secrets, for this tab only unless the user ticked
 * *Remember on this device* (a secret this device already holds,
 * unchanged, is left where it is, so re-importing an update of a board
 * never moves a remembered secret into the tab); then the secrets and view settings nothing
 * references any more. A secret that can't be stored or cleared is
 * reported once everything else is done, with how to clear what was left.
 *
 * @module
 */
import { CURRENT_SCHEMA_VERSION } from '@/domain/config/root';
import type { AppStores } from '@/storage';
import {
  type CredentialSecret,
  CredentialSecretSchema,
} from '@/storage/credentialStore';
import { LEFTOVER_SECRETS_HINT } from '@/storage/leftoverSecrets';

import type { ImportPlan } from './importPlan';

type ImportStores = Pick<AppStores, 'config' | 'credentials' | 'preferences'>;

/** Run `step` on each item, collecting (not throwing) failures. */
function each<T>(items: readonly T[], step: (item: T) => void): unknown[] {
  const failures: unknown[] = [];
  for (const item of items) {
    try {
      step(item);
    } catch (err) {
      failures.push(err);
    }
  }
  return failures;
}

const same = (a: CredentialSecret | undefined, b: CredentialSecret) =>
  a !== undefined &&
  JSON.stringify(CredentialSecretSchema.parse(a)) ===
    JSON.stringify(CredentialSecretSchema.parse(b));

/** Write `plan`; `remember` keeps the imported secrets on this device. */
export function applyImport(
  stores: ImportStores,
  plan: ImportPlan,
  remember: boolean,
): void {
  stores.config.save({
    schemaVersion: CURRENT_SCHEMA_VERSION,
    dashboards: plan.dashboards,
  });
  const failures = [
    ...each(plan.secrets, ({ id, secret }) => {
      const kept =
        same(stores.credentials.get(id), secret) &&
        (!remember || stores.credentials.isRemembered(id));
      if (!kept) stores.credentials.set(id, secret, remember);
    }),
    ...each(plan.forget, (id) => {
      stores.credentials.forget(id);
    }),
  ];
  for (const id of plan.removed) stores.preferences.forget(id);
  if (failures.length > 0) {
    throw new AggregateError(
      failures,
      `The dashboards were imported, but some credentials could not be stored or cleared in this browser. ${LEFTOVER_SECRETS_HINT}`,
    );
  }
}
