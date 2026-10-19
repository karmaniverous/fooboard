/**
 * Problems found while reading (spec.md A§4.3.7): keys a source rule
 * couldn't translate cleanly (with a count and a sample), and the window
 * hint, when a read came back full and a cell on its row has no records,
 * so its last record may be outside what was read. Pure.
 *
 * @module
 */
import type { SourceRule } from '@/domain/model/sourceRule';
import type { KeyProblem } from '@/domain/model/translate';

import { type Problem, problem } from './problems';

const SAMPLE_LENGTH = 120;

/** `found` grouped by key, each with how many records hit it and a
 * sample of the raw data it happened on. */
export function translationProblems(
  source: SourceRule,
  found: readonly KeyProblem[],
): Problem[] {
  const groups = new Map<string, { first: KeyProblem; count: number }>();
  for (const p of found) {
    const key = `${p.scope}:${p.key}:${p.kind}`;
    const group = groups.get(key);
    if (group) group.count += 1;
    else groups.set(key, { first: p, count: 1 });
  }
  return [...groups.values()].map(({ first, count }) => {
    const what = `${first.scope === 'item' ? 'item key' : 'key'} ${first.key}`;
    const sample = JSON.stringify(first.sample).slice(0, SAMPLE_LENGTH);
    const text =
      first.kind === 'untranslated'
        ? `no translation matched ${what}`
        : `copy found several values for ${what}`;
    return problem(
      { kind: 'dashboard' },
      `${source.name} source rule: ${text} (${String(count)}× e.g. ${sample})`,
    );
  });
}

/** The hint that row `rowId` may need more read. */
export const windowHint = (rowId: string, limit: string): Problem =>
  problem(
    { kind: 'row', id: rowId },
    `read ${limit}, the most its source rule reads; a stage with no records may be outside that: read more on the Sources tab`,
    true,
  );
