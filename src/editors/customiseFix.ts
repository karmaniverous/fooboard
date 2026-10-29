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
import { isBuiltinSourceId } from '@/domain/model/builtinSources';
import { sourceRuleFor } from '@/domain/model/sources';
import { type Problem, targetOf } from '@/domain/problems/problem';
import { PRESETS } from '@/domain/statuses/presets';

import type { EditorDraft } from './draft';
import { focusKeys } from './editTarget';
import { customiseSource } from './sources/customSource';
import { copySet } from './statuses/customSet';
import { replaceSet } from './statuses/overrideSets';

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
    return isBuiltinSourceId(id)
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
    dashboard: replaceSet(
      copied.dashboard,
      copied.copy.provider,
      builtin.id,
      copied.copy.id,
    ),
    draft: {
      tab: 'Statuses',
      focus: focusKeys({ kind: 'statusSet', id: copied.copy.id }),
    },
  };
}
