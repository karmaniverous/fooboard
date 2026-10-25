/**
 * Tests for which queries are kept at rest (spec.md §3.4, Decision 27): a
 * board's read made with the credential's remembered secret, and nothing
 * else: no editor lookup, nothing read with another secret, nothing whose
 * secret isn't known (even for a credential with none remembered), and
 * nothing that isn't one of the app's keys. The app search's lists are
 * board reads, kept (spec.md §3.12).
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { amplifyKey, githubKey } from '@/query/keys';
import { runsKey } from '@/test/persisted';

import { keepsQuery } from './keeps';

const remembered = new Map([
  ['gh', 'kept'],
  ['aws', 'kept'],
]);
const keeps = keepsQuery((id) => remembered.get(id));

describe('keepsQuery', () => {
  it.each([
    ['a board read with the remembered secret', runsKey('gh'), 'kept', true],
    ['a board read with another secret', runsKey('gh'), 'session', false],
    ['a board read whose secret is unknown', runsKey('gh'), undefined, false],
    [
      'an unknown secret where none is remembered',
      runsKey('none'),
      undefined,
      false,
    ],
    [
      'an editor lookup',
      githubKey('gh', { call: 'repos', page: 1 }),
      'kept',
      false,
    ],
    ['a key that isn’t the app’s', ['other', 'gh'], 'kept', false],
    [
      "the app search's list of a region",
      amplifyKey('aws', { call: 'apps', region: 'eu-west-1' }),
      'kept',
      true,
    ],
  ])('%s', (_, key, readWith, kept) => {
    expect(keeps(key, readWith)).toBe(kept);
  });
});
