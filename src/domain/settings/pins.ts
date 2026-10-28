/**
 * Which pinned apps a cell reads (spec.md §3.12): a cell reads the pins
 * keyed by the AWS key it resolves to, else the row's unkeyed pins (else
 * the apps the search finds building the row's repo, `engine/amplifyAccess`).
 * A keyed pin no cell of the row reads with is reported with a note.
 * *Pin* and *Unpin* from a problem change a row's pins. Pure.
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

/** Do two pins name the same app under the same key? */
export const samePin = (a: PinnedApp, b: PinnedApp): boolean =>
  a.region === b.region &&
  a.appId === b.appId &&
  a.credentialId === b.credentialId;

/** Pinning an app to a row, or unpinning one. */
export interface PinChange {
  kind: 'pin' | 'unpin';
  rowId: string;
  pin: PinnedApp;
}

/** `d` with `change` made to its Amplify row: an app already pinned isn't
 * pinned twice, and a row without a repo keeps its last pin (it needs a
 * repo or a pin). */
export function changePins(d: Dashboard, change: PinChange): Dashboard {
  const pinned = (row: AmplifyRow): PinnedApp[] => {
    const has = row.pinnedApps.some((p) => samePin(p, change.pin));
    if (change.kind === 'pin')
      return has ? row.pinnedApps : [...row.pinnedApps, change.pin];
    const left = row.pinnedApps.filter((p) => !samePin(p, change.pin));
    return row.repo === undefined && left.length === 0 ? row.pinnedApps : left;
  };
  return {
    ...d,
    rows: d.rows.map((row) =>
      row.id === change.rowId && row.type === 'amplify'
        ? { ...row, pinnedApps: pinned(row) }
        : row,
    ),
  };
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
