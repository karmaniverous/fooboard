/**
 * Window hints (spec.md A§4.3.7 *Reader options*): when a read came back
 * full, each of its rows' cells showing *No records* gets a dismissable
 * hint to read more on the Sources tab. Pure.
 *
 * @module
 */
import type { Provider } from '@/domain/config/providers';
import type { CellDerivation } from '@/domain/derivation';
import type { Problem } from '@/domain/problems/problem';
import { windowHint } from '@/domain/problems/runtime';

/** Hints for every empty cell in `rows` (row id to stage id to cell). */
export function windowHints(
  rows: Readonly<
    Record<string, Readonly<Record<string, { derivation: CellDerivation }>>>
  >,
  provider: Provider,
  limit: string,
): Problem[] {
  return Object.entries(rows).flatMap(([rowId, cells]) =>
    Object.entries(cells)
      .filter(
        ([, { derivation: d }]) =>
          d.kind === 'empty' && d.state === 'no-records',
      )
      .map(([stageId]) => windowHint({ rowId, stageId }, provider, limit)),
  );
}
