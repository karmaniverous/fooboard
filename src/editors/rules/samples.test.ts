/**
 * Tests for rule samples: the field picker's paths (record keys, item
 * keys, `_raw` leaves; item scope) and the board's records per source.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { compilePath, valuesAt } from '@/domain/rules/path';

import { ruleSamples, SAMPLE_LIMIT, samplePaths } from './samples';

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

  it('offers keys with quotes or backslashes as paths that find them', () => {
    const odd = { "it's": 1, 'a\\b': 2 };
    const found = samplePaths([odd]).map((p) => {
      const path = compilePath(p);
      return path.ok ? valuesAt(path.query, odd) : path.message;
    });
    expect(found).toHaveLength(2);
    expect(found).toEqual(expect.arrayContaining([[1], [2]]));
  });

  it('offers item keys at item scope', () => {
    expect(samplePaths([record], 'item')).toEqual(['$.name', '$.state']);
  });
});

describe('ruleSamples', () => {
  it('keeps at most SAMPLE_LIMIT records per source', () => {
    const cells = Object.fromEntries(
      Array.from({ length: SAMPLE_LIMIT + 1 }, (_, i) => [
        String(i),
        {
          rowId: 'web',
          derivation: { kind: 'ok', document: { n: i } },
        },
      ]),
    );
    expect(
      ruleSamples([{ id: 'web', type: 'github' }], cells).github,
    ).toHaveLength(SAMPLE_LIMIT);
  });

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
