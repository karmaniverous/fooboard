/**
 * Which pinned apps a cell reads (spec.md §3.12): a cell reads the pins
 * keyed by the AWS key it resolves to, else the row's unkeyed pins. (Until
 * N3c adds the search, a cell no pin serves reads no app.) A keyed pin no
 * cell of the row reads with is reported with a note. Pure.
 *
 * @module
 */
import type { Dashboard } from '@/domain/config/dashboard';
import type { AmplifyRow, PinnedApp } from '@/domain/config/row';

import { cellCredentials } from './credentials';

/** The pins of `row` a cell resolving to `key` reads. */
export function pinsFor(
  row: Pick<AmplifyRow, 'pinnedApps'>,
  key: string,
): PinnedApp[] {
  const keyed = row.pinnedApps.filter((p) => p.credentialId === key);
  return keyed.length > 0
    ? keyed
    : row.pinnedApps.filter((p) => p.credentialId === undefined);
}

/** A pin serving one key. */
type KeyedPin = PinnedApp & { credentialId: string };

/** The keyed pins of `row` whose key no cell of the row reads with. */
export function unusedPins(d: Dashboard, row: AmplifyRow): KeyedPin[] {
  const keys = new Set(cellCredentials(d, row, 'awsKey').values());
  return row.pinnedApps.filter(
    (p): p is KeyedPin =>
      p.credentialId !== undefined && !keys.has(p.credentialId),
  );
}
