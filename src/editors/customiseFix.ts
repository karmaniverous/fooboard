/**
 * *Customise* from a problem (spec.md A§4.3.7 *Rule problems*: a problem
 * in a built-in rule offers *Customise* directly): copy the built-in
 * source rule or status-set preset into the dashboard, use the copy where
 * the built-in was used, and open the editor on it. Pure.
 *
 * @module
 */
import type { Dashboard } from '@/domain/config/dashboard';
import type { Provider } from '@/domain/config/providers';
import { BUILTIN_SOURCES } from '@/domain/model/builtinSources';
import { sourceRuleFor } from '@/domain/model/sources';
import { type Problem, targetOf } from '@/domain/problems/problem';
import { PRESETS } from '@/domain/statuses/presets';

import type { EditorDraft } from './draft';
import { focusKeys } from './editTarget';
import { customiseSource } from './sources/customSource';
import { copySet } from './statuses/customSet';

/** The built-in a problem is in, if it is in one. */
function builtinOf(
  dashboard: Dashboard,
  problem: Problem,
):
  | { kind: 'source'; provider: Provider; id: string }
  | { kind: 'statusSet'; id: string }
  | undefined {
  const target = targetOf(problem);
  if (target.kind === 'source') {
    const { id } = sourceRuleFor(dashboard, target.provider);
    return BUILTIN_SOURCES.some((s) => s.id === id)
      ? { kind: 'source', provider: target.provider, id }
      : undefined;
  }
  if (target.kind === 'statusSet' && PRESETS.some((p) => p.id === target.id))
    return { kind: 'statusSet', id: target.id };
  return undefined;
}

/** Does `problem` offer *Customise*? */
export const offersCustomise = (
  dashboard: Dashboard,
  problem: Problem,
): boolean => builtinOf(dashboard, problem) !== undefined;

/** Every choice of status set `from` in `d`, made `to` instead. */
function replaceSet(d: Dashboard, from: string, to: string): Dashboard {
  const swap = <V extends string | undefined>(v: V): V | string =>
    v === from ? to : v;
  return {
    ...d,
    statusSets: {
      github: swap(d.statusSets.github),
      amplify: swap(d.statusSets.amplify),
    },
    rowGroups: d.rowGroups.map((g) => ({
      ...g,
      statusSets: {
        ...g.statusSets,
        ...(g.statusSets.github && { github: swap(g.statusSets.github) }),
        ...(g.statusSets.amplify && { amplify: swap(g.statusSets.amplify) }),
      },
    })),
    rows: d.rows.map((r) => ({
      ...r,
      statusSet: r.statusSet === from ? to : r.statusSet,
      cellStatusSets: Object.fromEntries(
        Object.entries(r.cellStatusSets).map(([k, v]) => [k, swap(v)]),
      ),
    })),
  };
}

/** The dashboard with the problem's built-in customised, and the editor
 * opened on the copy; undefined when the problem is in no built-in. */
export function customiseFor(
  dashboard: Dashboard,
  problem: Problem,
): { dashboard: Dashboard; draft: EditorDraft } | undefined {
  const builtin = builtinOf(dashboard, problem);
  if (!builtin) return undefined;
  if (builtin.kind === 'source')
    return {
      dashboard: customiseSource(dashboard, builtin.id),
      draft: { tab: 'Sources', focus: focusKeys(targetOf(problem)) },
    };
  const copied = copySet(dashboard, builtin.id);
  if (!copied) return undefined;
  return {
    dashboard: replaceSet(copied.dashboard, builtin.id, copied.copy.id),
    draft: {
      tab: 'Statuses',
      focus: focusKeys({ kind: 'statusSet', id: copied.copy.id }),
    },
  };
}
