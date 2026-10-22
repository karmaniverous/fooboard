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

/** A row's derived cells, by stage id. */
type RowCells = Readonly<
  Partial<Record<string, { derivation: CellDerivation }>>
>;

/** Hints for `rowIds`' empty cells when the read came back `full`,
 * none otherwise; `cells` gives a row's derived cells. */
export const fullReadHints = (
  full: boolean,
  rowIds: readonly string[],
  cells: (rowId: string) => RowCells | undefined,
  source: SourceRule,
): Problem[] =>
  full
    ? windowHints(
        Object.fromEntries(rowIds.map((id) => [id, cells(id) ?? {}])),
        source,
      )
    : [];

/** Hints for every empty cell in `rows` (row id to stage id to cell),
 * read with `source`. */
function windowHints(
  rows: Readonly<Record<string, RowCells>>,
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
