/**
 * Problems a source rule has on its own (spec.md A§4.3.7 *Rule problems*):
 * translation, keep and branch rules whose checks can't run, copy paths
 * and the items path that don't parse, and an order key that names none
 * of its keys. Reported on the dashboard (where source rules live), with
 * the Sources tab as the place to fix them. Pure.
 *
 * @module
 */
import type { KeyDef, SourceRule } from '@/domain/model/sourceRule';
import { ruleProblems } from '@/domain/rules/check';
import { compilePath } from '@/domain/rules/path';

import { type Problem, problem } from './problem';

/** Problems in one list of keys. */
function keyProblems(keys: readonly KeyDef[], noun: string): string[] {
  return keys.flatMap((k) =>
    k.translations.flatMap((t) => {
      const rules = ruleProblems(t.rule).map((m) => `${noun} ${k.name}: ${m}`);
      if (!('copy' in t)) return rules;
      const path = compilePath(t.copy);
      return path.ok
        ? rules
        : [...rules, `${noun} ${k.name} copies ${t.copy}: ${path.message}`];
    }),
  );
}

/** Every problem `source` has on its own. */
export function sourceRuleProblems(source: SourceRule): Problem[] {
  const messages = [
    ...keyProblems(source.keys, 'key'),
    ...ruleProblems(source.keep).map((m) => `keep rule: ${m}`),
  ];
  if (source.items) {
    const path = compilePath(source.items.path);
    if (!path.ok)
      messages.push(`items path ${source.items.path}: ${path.message}`);
    messages.push(...keyProblems(source.items.keys, 'item key'));
  }
  if (!source.keys.some((k) => k.name === source.order))
    messages.push(
      `order key ${source.order} is none of its keys, so no record is placed`,
    );
  if (source.provider === 'amplify')
    messages.push(
      ...ruleProblems(source.reader.branches).map((m) => `branch rule: ${m}`),
    );
  return messages.map((m) =>
    problem({ kind: 'dashboard' }, `${source.name} source rule: ${m}`, false, {
      target: { kind: 'source', provider: source.provider },
    }),
  );
}
