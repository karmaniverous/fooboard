/**
 * A column header's tooltip: the stage name and the branch patterns of
 * its stage rules that are plain branch rules (spec.md A§4.3.7). One
 * pattern when every stage rule it sets is that pattern; otherwise each
 * pattern labelled with its source, so no column claims a pattern one of
 * its sources doesn't use. Pure.
 *
 * @module
 */
import { PROVIDER_LABELS, PROVIDERS } from '@/domain/config/providers';
import type { Stage } from '@/domain/config/stage';
import { branchOf } from '@/domain/rules/branch';

export function stageLabel(stage: Pick<Stage, 'name' | 'rules'>): string {
  const set = PROVIDERS.filter((p) => stage.rules[p] !== undefined).map(
    (p) => ({ p, pattern: branchOf(stage.rules[p]) }),
  );
  const patterns = set.flatMap(({ p, pattern }) =>
    pattern === undefined ? [] : [{ p, pattern }],
  );
  const first = patterns.at(0);
  if (first === undefined) return stage.name;
  if (set.every(({ pattern }) => pattern === first.pattern))
    return `${stage.name} (${first.pattern})`;
  const each = patterns.map(
    ({ p, pattern }) => `${PROVIDER_LABELS[p]}: ${pattern}`,
  );
  return `${stage.name} (${each.join(', ')})`;
}
