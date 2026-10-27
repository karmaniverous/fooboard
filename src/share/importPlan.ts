/**
 * What an import changes (spec.md §3.8 *Credential ids on import*): the
 * whole new dashboard list, the secrets to store and under which ids, the
 * secrets no longer referenced and the dashboards gone. Pure: the dialog
 * plans, and nothing is written until *Import* applies the plan.
 *
 * - *Add*: a dashboard with a new id is added with its ids; one whose id
 *   is already here is replaced (keeping its ids, so this device's secrets
 *   for them are overwritten) or kept as a copy (a new dashboard id and
 *   new credential ids at all six settings levels and in pinned apps,
 *   through `duplicateDashboard`).
 * - *Replace the whole setup*: the chosen dashboards, with their ids, and
 *   every secret no longer referenced forgotten, as *Reset* does.
 *
 * Query keys hold credential ids, so two dashboards never share one: an
 * added or replacing dashboard whose credential id another dashboard here
 * already holds gets a new id for it.
 *
 * @module
 */
import type { Dashboard } from '@/domain/config/dashboard';
import { duplicateDashboard } from '@/editors/edit';
import type { CredentialSecret } from '@/storage/credentialStore';

import type { ShareSecrets } from './secrets';

/** For a dashboard whose id is already here. */
export type SameIdChoice = 'replace' | 'copy';
export type ImportMode = 'add' | 'replaceAll';

export interface ImportChoice {
  /** The dashboards chosen from the share. */
  dashboards: readonly Dashboard[];
  mode: ImportMode;
  /** Per dashboard id already here (*add* only); *replace* if unsaid. */
  sameId: Readonly<Partial<Record<string, SameIdChoice>>>;
  /** The share's secrets, when the user imports them. */
  secrets: ShareSecrets | null;
}

export interface ImportPlan {
  /** The whole dashboard list after the import. */
  dashboards: Dashboard[];
  /** Secrets to store, under the ids the imported dashboards now use,
   * each with its credential's label. */
  secrets: { id: string; label: string; secret: CredentialSecret }[];
  /** Credential ids no dashboard references any more. */
  forget: string[];
  /** Dashboard ids no longer present. */
  removed: string[];
  /** The imported dashboards' ids here (a copy's new one). */
  imported: string[];
}

const credentialIds = (dashboards: readonly Dashboard[]): Set<string> =>
  new Set(dashboards.flatMap((d) => d.credentials.map((c) => c.id)));

/** The share's secrets for `placed`, whose credentials are `original`'s
 * in order (re-ided or not); a secret of the wrong kind is left out. */
function secretsFor(
  original: Dashboard,
  placed: Dashboard,
  secrets: ShareSecrets | null,
): ImportPlan['secrets'] {
  if (!secrets) return [];
  return original.credentials.flatMap((ref, i) => {
    const secret = Object.hasOwn(secrets, ref.id) ? secrets[ref.id] : null;
    const id = placed.credentials.at(i)?.id;
    return secret?.kind === ref.kind && id
      ? [{ id, label: ref.label, secret }]
      : [];
  });
}

/** `dashboard` with a new id for each credential id in `taken`. */
const rekeyTaken = (
  dashboard: Dashboard,
  taken: ReadonlySet<string>,
  newId: () => string,
): Dashboard =>
  duplicateDashboard(dashboard, dashboard.id, dashboard.name, (old) =>
    taken.has(old) ? newId() : old,
  );

function planAdd(
  existing: readonly Dashboard[],
  choice: ImportChoice,
  newId: () => string,
): ImportPlan {
  const list = [...existing];
  const plan: ImportPlan = {
    dashboards: list,
    secrets: [],
    forget: [],
    removed: [],
    imported: [],
  };
  for (const incoming of choice.dashboards) {
    const at = list.findIndex((d) => d.id === incoming.id);
    const copy = at >= 0 && choice.sameId[incoming.id] === 'copy';
    let placed: Dashboard;
    if (copy) {
      placed = duplicateDashboard(
        incoming,
        newId(),
        `${incoming.name} (copy)`,
        newId,
      );
      list.push(placed);
    } else {
      const others = list.filter((_, i) => i !== at);
      placed = rekeyTaken(incoming, credentialIds(others), newId);
      if (at < 0) list.push(placed);
      else {
        const kept = credentialIds([placed]);
        plan.forget.push(
          ...[...credentialIds([list[at] ?? placed])].filter(
            (id) => !kept.has(id),
          ),
        );
        list[at] = placed;
      }
    }
    plan.secrets.push(...secretsFor(incoming, placed, choice.secrets));
    plan.imported.push(placed.id);
  }
  return plan;
}

function planReplaceAll(
  existing: readonly Dashboard[],
  choice: ImportChoice,
): ImportPlan {
  const dashboards = [...choice.dashboards];
  const kept = credentialIds(dashboards);
  const ids = new Set(dashboards.map((d) => d.id));
  return {
    dashboards,
    secrets: dashboards.flatMap((d) => secretsFor(d, d, choice.secrets)),
    forget: [...credentialIds(existing)].filter((id) => !kept.has(id)),
    removed: existing.map((d) => d.id).filter((id) => !ids.has(id)),
    imported: [...ids],
  };
}

/** Plan importing `choice` over the `existing` dashboards. */
export function planImport(
  existing: readonly Dashboard[],
  choice: ImportChoice,
  newId: () => string = () => crypto.randomUUID(),
): ImportPlan {
  return choice.mode === 'add'
    ? planAdd(existing, choice, newId)
    : planReplaceAll(existing, choice);
}
