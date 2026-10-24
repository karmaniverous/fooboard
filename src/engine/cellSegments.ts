/**
 * A row's columns split by the credential each cell reads with (spec.md
 * §3.11: every consumer asks per cell), so each part derives under its
 * own token or key and the parts merge back into one row. Pure.
 *
 * @module
 */
import { unique } from 'radash';

import type { Stage } from '@/domain/config/stage';

import type { RowDerivation } from './need';

/** Columns sharing one key, in board order. */
export interface Segment<K> {
  key: K;
  stages: Stage[];
}

/** `stages` grouped by `keyOf`, in order of first appearance. */
export function segments<K>(
  stages: readonly Stage[],
  keyOf: (stageId: string) => K,
): Segment<K>[] {
  const out: Segment<K>[] = [];
  for (const stage of stages) {
    const key = keyOf(stage.id);
    const found = out.find((s) => s.key === key);
    if (found) found.stages.push(stage);
    else out.push({ key, stages: [stage] });
  }
  return out;
}

/** One row's derivation from its parts: cells, needs and problems
 * joined; refreshed when the oldest part last landed. */
export function mergeDerivations(
  parts: readonly RowDerivation[],
): RowDerivation {
  const refreshed = parts.flatMap((p) =>
    p.refreshedAt === undefined ? [] : [p.refreshedAt],
  );
  return {
    cells: parts.reduce<RowDerivation['cells']>(
      (cells, p) => ({ ...cells, ...p.cells }),
      {},
    ),
    needs: parts.flatMap((p) => p.needs),
    // Two parts failing alike raise one problem.
    problems: unique(
      parts.flatMap((p) => p.problems),
      (p) => p.id,
    ),
    ...(refreshed.length > 0 ? { refreshedAt: Math.min(...refreshed) } : {}),
  };
}
