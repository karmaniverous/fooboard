/**
 * Window hints (spec.md A§4.3.7 *Reader options*): when a read came back
 * full, each of its rows' cells showing *No records* gets a dismissable
 * hint to read more on the Sources tab. Pure.
 *
 * @module
 */
import type { CellDerivation } from '@/domain/derivation';
import { EMPTY_STATES } from '@/domain/derivation';
import type { SourceRule } from '@/domain/model/sourceRule';
import type { Problem } from '@/domain/problems/problem';
import { windowHint } from '@/domain/problems/runtime';

/** Hints for every empty cell in `rows` (row id to stage id to cell),
 * read with `source`. */
export function windowHints(
  rows: Readonly<
    Record<
      string,
      Readonly<Partial<Record<string, { derivation: CellDerivation }>>>
    >
  >,
  source: SourceRule,
): Problem[] {
  return Object.entries(rows).flatMap(([rowId, cells]) =>
    Object.entries(cells)
      .filter(
        ([, cell]) =>
          cell?.derivation.kind === 'empty' &&
          cell.derivation.state === EMPTY_STATES.noRecords,
      )
      .map(([stageId]) => windowHint({ rowId, stageId }, source)),
  );
}
