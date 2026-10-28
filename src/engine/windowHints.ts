/**
 * Window hints (spec.md A§4.3.7 *Reader options*, §3.12 *Reads deduped*):
 * when a read came back full, each cell it serves that shows *No records*
 * gets a dismissable hint to read more on the Sources tab; cells reading
 * with another credential, or another app, get none from it. Pure.
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

/** The cells of one row that a read serves. */
export interface ServedCells {
  rowId: string;
  stageIds: readonly string[];
}

/** The cells `readers` (rows, each with the columns a read serves) read
 * with. */
export const servedBy = (
  readers: readonly { row: { id: string }; stageIds: readonly string[] }[],
): ServedCells[] =>
  readers.map(({ row, stageIds }) => ({ rowId: row.id, stageIds }));

/** Hints for the empty cells of `served` when the read came back `full`,
 * none otherwise; `cells` gives a row's derived cells. */
export const fullReadHints = (
  full: boolean,
  served: readonly ServedCells[],
  cells: (rowId: string) => RowCells,
  source: SourceRule,
): Problem[] =>
  full
    ? windowHints(
        Object.fromEntries(
          served.map(({ rowId, stageIds }) => {
            const all = cells(rowId);
            return [
              rowId,
              Object.fromEntries(stageIds.map((s) => [s, all[s]])),
            ];
          }),
        ),
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
