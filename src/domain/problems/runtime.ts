/**
 * Problems found while reading (spec.md A§4.3.7): keys a source rule
 * couldn't translate cleanly (with a count and a sample), and the window
 * hint, when a read came back full and a cell on its row has no records,
 * so its last record may be outside what was read: on that cell, fixed on
 * the Sources tab, dismissable. Pure.
 *
 * @module
 */
import type { SourceRule } from '@/domain/model/sourceRule';
import type { KeyProblem } from '@/domain/model/translate';

import { type Problem, problem } from './problem';

/** The most characters of raw data a translation problem quotes. */
export const SAMPLE_LENGTH = 120;

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
      false,
      { target: { kind: 'source', provider: source.provider, key: first.key } },
    );
  });
}

/** How much `source` reads, in words (e.g. "100 runs"). */
export const readLimit = (source: SourceRule): string =>
  source.provider === 'github'
    ? `${String(source.reader.runs)} runs`
    : `${String(source.reader.jobsPerBranch)} jobs per branch`;

/** The hint that the empty cell at `rowId` and `stageId`, read with
 * `source`, may need more read. */
export const windowHint = (
  cell: { rowId: string; stageId: string },
  source: SourceRule,
): Problem =>
  problem(
    { kind: 'cell', ...cell },
    `read ${readLimit(source)}, the most its source rule reads; this cell's last record may be older: read more on the Sources tab`,
    true,
    { target: { kind: 'source', provider: source.provider } },
  );
