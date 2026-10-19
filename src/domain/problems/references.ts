/**
 * References that don't resolve (spec.md A§4.3.7 *Data model version*,
 * *Consistency*): an unknown source-rule or status-set id, or a status set
 * chosen for a row of another source. These never stop a board loading:
 * the built-in default is used, and a problem is reported at the level
 * that holds the reference. Pure.
 *
 * @module
 */
import type { Dashboard } from '@/domain/config/dashboard';
import type { Row } from '@/domain/config/row';
import {
  DEFAULT_STATUS_SET_IDS,
  PROVIDER_LABELS,
  STATUS_PROVIDERS,
  type StatusProvider,
} from '@/domain/config/statusSets';
import { BUILTIN_SOURCES } from '@/domain/model/builtinSources';
import { findSourceRule } from '@/domain/model/sources';
import { presetById } from '@/domain/statuses/presets';
import { findStatusSet } from '@/domain/statuses/resolve';

import {
  type EditTarget,
  type Problem,
  problem,
  type ProblemLevel,
} from './problem';

/** Why `found` can't serve `provider`, or `undefined` when it can. */
function mismatch(
  id: string,
  found: { provider: StatusProvider } | undefined,
  provider: StatusProvider,
  noun: string,
): string | undefined {
  if (!found) return `unknown ${noun} ${id}`;
  return found.provider === provider
    ? undefined
    : `${noun} ${id} is for ${PROVIDER_LABELS[found.provider]}, not ${PROVIDER_LABELS[provider]}`;
}

/** Source rules the dashboard names that are unknown or another
 * source's. */
function sourceRefProblems(d: Dashboard): Problem[] {
  return STATUS_PROVIDERS.flatMap((p) => {
    const id = d.sourceRules[p];
    const why = mismatch(
      id,
      findSourceRule(id, d.customSourceRules),
      p,
      'source rule',
    );
    const builtin = BUILTIN_SOURCES.find((s) => s.provider === p);
    return why
      ? [
          problem(
            { kind: 'dashboard' },
            `${why}: using the built-in ${builtin?.name ?? p} rule`,
            false,
            { target: { kind: 'source', provider: p } },
          ),
        ]
      : [];
  });
}

/** Status sets chosen at each level that are unknown, or for another
 * source than the rows there. */
function statusSetRefProblems(d: Dashboard): Problem[] {
  const out: Problem[] = [];
  const check = (
    id: string | undefined,
    provider: StatusProvider,
    level: ProblemLevel,
    target: EditTarget,
  ) => {
    if (id === undefined) return;
    const why = mismatch(
      id,
      findStatusSet(id, d.customStatusSets),
      provider,
      'status set',
    );
    if (why)
      out.push(
        problem(
          level,
          `${why}: using ${presetById(DEFAULT_STATUS_SET_IDS[provider]).name}`,
          false,
          { target },
        ),
      );
  };
  for (const p of STATUS_PROVIDERS)
    check(
      d.statusSets[p],
      p,
      { kind: 'dashboard' },
      {
        kind: 'dashboard',
        part: 'statusSets',
      },
    );
  for (const g of d.rowGroups) {
    const level = { kind: 'rowGroup', id: g.id } as const;
    for (const p of STATUS_PROVIDERS) check(g.statusSets[p], p, level, level);
  }
  const stageIds = new Set(d.stages.map((s) => s.id));
  for (const row of d.rows) {
    const p: Row['type'] = row.type;
    const level = { kind: 'row', id: row.id } as const;
    check(row.statusSet, p, level, level);
    for (const [stageId, id] of Object.entries(row.cellStatusSets))
      if (stageIds.has(stageId))
        check(
          id,
          p,
          { kind: 'cell', rowId: row.id, stageId },
          { ...level, stageId },
        );
  }
  return out;
}

/** Every reference in `d` that doesn't resolve. */
export const referenceProblems = (d: Dashboard): Problem[] => [
  ...sourceRefProblems(d),
  ...statusSetRefProblems(d),
];
