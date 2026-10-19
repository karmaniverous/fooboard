/**
 * Tests for rule samples: the field picker's paths (record keys, item
 * keys, `_raw` leaves; item scope) and the board's records per source.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { ruleSamples, samplePaths } from './samples';

const record = {
  workflow: 'CI',
  'odd key': 1,
  items: [{ name: 'deploy', state: 'success' }],
  _raw: { run: { event: 'push' }, branch: 'main' },
};

describe('samplePaths', () => {
  it('offers record keys, item keys and raw leaves', () => {
    expect(samplePaths([record])).toEqual(
      [
        "$['odd key']",
        '$._raw.branch',
        '$._raw.run.event',
        '$.items[*].name',
        '$.items[*].state',
        '$.workflow',
      ].sort(),
    );
  });

  it('offers item keys at item scope', () => {
    expect(samplePaths([record], 'item')).toEqual(['$.name', '$.state']);
  });
});

describe('ruleSamples', () => {
  it("groups ok cells' records by their row's source", () => {
    const doc = { workflow: 'CI' };
    expect(
      ruleSamples(
        [
          { id: 'web', type: 'github' },
          { id: 'site', type: 'amplify' },
        ],
        {
          a: { rowId: 'web', derivation: { kind: 'ok', document: doc } },
          b: { rowId: 'site', derivation: { kind: 'empty' } },
          c: undefined,
        },
      ),
    ).toEqual({ github: [doc], amplify: [] });
  });
});
