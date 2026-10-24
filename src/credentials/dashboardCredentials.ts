/**
 * Changes to a dashboard's credential list (spec.md C-1a, §3.11): adding
 * a credential (the first of its kind becomes the dashboard's setting),
 * making one the dashboard's, and removing one (clearing it at every
 * level and dropping the pinned apps keyed by it, so the dashboard stays
 * valid). Secrets live in the credential store; these functions only
 * touch the configuration. Pure.
 *
 * @module
 */
import { omit } from 'radash';

import type {
  CredentialKind,
  CredentialRef,
} from '@/domain/config/credentials';
import type { Dashboard } from '@/domain/config/dashboard';
import type { PinnedApp, Row } from '@/domain/config/row';
import { mapSettings, setSettings } from '@/domain/settings/places';

/** A new, globally unique credential id (ids key the secret store). */
export const newCredentialId = (): string => crypto.randomUUID();

/** The settings field a credential kind fills. */
export const FIELD_OF = {
  github: 'githubToken',
  aws: 'awsKey',
} as const satisfies Record<CredentialKind, string>;

/** `dashboard` with its own setting for `kind` set to `id`: *Make
 * default* (spec.md §3.11). */
export const setDefaultCredential = (
  dashboard: Dashboard,
  kind: CredentialKind,
  id: string,
): Dashboard =>
  setSettings(
    dashboard,
    { level: 'dashboard' },
    {
      ...dashboard.settings,
      [FIELD_OF[kind]]: id,
    },
  );

export function addCredential(
  dashboard: Dashboard,
  ref: CredentialRef,
): Dashboard {
  const added = {
    ...dashboard,
    credentials: [...dashboard.credentials, ref],
  };
  return dashboard.settings[FIELD_OF[ref.kind]]
    ? added
    : setDefaultCredential(added, ref.kind, ref.id);
}

/** `row` with its pins' keys rewritten by `change`. */
const mapPins = (
  row: Row,
  change: (pins: readonly PinnedApp[]) => PinnedApp[],
): Row =>
  row.type === 'amplify' ? { ...row, pinnedApps: change(row.pinnedApps) } : row;

/** A pin with its key passed through `re`. */
const rekey = (pin: PinnedApp, re: (ref: string) => string | undefined) => {
  const credentialId = pin.credentialId ? re(pin.credentialId) : undefined;
  const rest = omit(pin, ['credentialId']);
  return credentialId ? { ...rest, credentialId } : rest;
};

/** Rewrite every credential reference (the settings at every level and
 * pinned apps' keys) through `map`; `undefined` clears a reference. */
export function mapCredentialRefs(
  dashboard: Dashboard,
  map: (ref: string) => string | undefined,
): Dashboard {
  const re = (ref: string | undefined) => (ref ? map(ref) : undefined);
  const settled = mapSettings(dashboard, (s) => {
    const { githubToken, awsKey, ...rest } = s;
    const github = re(githubToken);
    const aws = re(awsKey);
    return {
      ...rest,
      ...(github ? { githubToken: github } : {}),
      ...(aws ? { awsKey: aws } : {}),
    };
  });
  return {
    ...settled,
    rows: settled.rows.map((row) =>
      mapPins(row, (pins) => pins.map((pin) => rekey(pin, map))),
    ),
  };
}

/** `row` without the pins keyed by `id`; the last pin of a row without a
 * repo is kept, unkeyed, since such a row needs one. */
const dropPins = (row: Row, id: string): Row =>
  mapPins(row, (pins) => {
    const kept = pins.filter((p) => p.credentialId !== id);
    if (kept.length > 0 || row.repo !== undefined) return kept;
    return pins.slice(0, 1).map((pin) => rekey(pin, () => undefined));
  });

export function removeCredential(dashboard: Dashboard, id: string): Dashboard {
  const cleared = mapCredentialRefs(
    { ...dashboard, rows: dashboard.rows.map((row) => dropPins(row, id)) },
    (ref) => (ref === id ? undefined : ref),
  );
  return {
    ...cleared,
    credentials: dashboard.credentials.filter((c) => c.id !== id),
  };
}
