/**
 * Window hints (spec.md A§4.3.7 *Reader options*, §3.12 *Reads deduped*):
 * when a read came back full, each cell it serves that shows *No records*
 * gets a dismissable hint to read more on the Sources tab; cells reading
 * with another credential, or another app, get none from it. An Amplify
 * cell whose stage rule is a branch pattern is judged by the reads of the
 * branches its pattern matches, each on its own (spec 0.2.0 §3.B;
 * Decision 94). Pure.
 *
 * @module
 */
import type { CellDerivation } from '@/domain/derivation';
import { EMPTY_STATES } from '@/domain/derivation';
import { matchesBranchPattern } from '@/domain/matching/branchPattern';
import type { SourceRule } from '@/domain/model/sourceRule';
import type { Problem } from '@/domain/problems/problem';
import { windowHint } from '@/domain/problems/runtime';
import { branchOf } from '@/domain/rules/branch';
import type { Rule } from '@/domain/rules/schema';

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

/** Whether the read serving a cell came back full, by row and stage. */
export type FullFor = (rowId: string, stageId: string) => boolean;

/** One branch an Amplify app's jobs were read for, and whether that
 * branch's own read came back full. */
export interface ReadBranch {
  name: string;
  full: boolean;
}

/** Whether reading more could find an older job for an Amplify cell with
 * stage rule `stageRule`, given what its app's read found (spec 0.2.0
 * §3.B): when the rule is exactly a branch pattern, only if some branch
 * it matches was read full itself; when it isn't (or there is none), or
 * the dashboard's Amplify source rule is a custom one (`customSource`:
 * its branch key may not be the branch Amplify lists), when any branch
 * was. */
export function amplifyCellFull(
  read: { full: boolean; readBranches: readonly ReadBranch[] },
  stageRule: Rule | undefined,
  customSource: boolean,
): boolean {
  const pattern = customSource ? undefined : branchOf(stageRule);
  if (pattern === undefined) return read.full;
  return read.readBranches.some(
    (branch) => branch.full && matchesBranchPattern(pattern, branch.name),
  );
}

/** Hints for the empty cells of `served` whose read came back full
 * (`fullFor`); `cells` gives a row's derived cells. */
export const fullReadHints = (
  fullFor: FullFor,
  served: readonly ServedCells[],
  cells: (rowId: string) => RowCells,
  source: SourceRule,
): Problem[] =>
  served.flatMap(({ rowId, stageIds }) => {
    const all = cells(rowId);
    return stageIds
      .filter((stageId) => {
        const cell = all[stageId];
        return (
          cell?.derivation.kind === 'empty' &&
          cell.derivation.state === EMPTY_STATES.noRecords &&
          fullFor(rowId, stageId)
        );
      })
      .map((stageId) => windowHint({ rowId, stageId }, source));
  });
