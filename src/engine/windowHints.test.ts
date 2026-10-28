/**
 * Tests for window hints (spec.md A§4.3.7, §3.12 *Reads deduped*): a full
 * read hints only the *No records* cells it serves (an app's or a token's
 * columns), and nothing when it wasn't full.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { measureBoard } from '@/demo/scenarios/measure';
import { EMPTY_STATES } from '@/domain/derivation';
import { sourceRuleFor } from '@/domain/model/sources';

import { fullReadHints, servedBy } from './windowHints';

const empty = {
  derivation: {
    kind: 'empty',
    state: EMPTY_STATES.noRecords,
  },
} as const;
const cells = () => ({ dev: empty, prod: empty });
const source = sourceRuleFor(measureBoard, 'amplify');

describe('fullReadHints', () => {
  it('hints only the empty cells the full read serves', () => {
    const hints = fullReadHints(
      true,
      servedBy([{ row: { id: 'site' }, stageIds: ['prod'] }]),
      cells,
      source,
    );
    expect(hints).toHaveLength(1);
    expect(hints[0]?.level).toMatchObject({ stageId: 'prod' });
    expect(
      fullReadHints(
        true,
        [{ rowId: 'site', stageIds: ['dev', 'prod'] }],
        cells,
        source,
      ),
    ).toHaveLength(2);
  });

  it('hints nothing when the read was not full', () => {
    expect(
      fullReadHints(
        false,
        [{ rowId: 'site', stageIds: ['prod'] }],
        cells,
        source,
      ),
    ).toEqual([]);
  });
});
