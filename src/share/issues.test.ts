/**
 * Tests for field-level import errors' paths and lines (spec 0.2.0 §3.J
 * *Paths*): zod's path written for a reader, the whole share written
 * `share`, and text that isn't JSON described by its error's position
 * alone, never any of its text.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { issueLine, issuePath, notJsonIssue, WHOLE_SHARE } from './issues';

describe('issuePath', () => {
  it.each([
    [[], WHOLE_SHARE],
    [['a', 'b', 0, 'c'], 'a.b[0].c'],
    [
      [
        'dashboards',
        0,
        'stages',
        3,
        'rules',
        'github',
        'checks',
        0,
        'operator',
      ],
      'dashboards[0].stages[3].rules.github.checks[0].operator',
    ],
    [[0, 'id'], '[0].id'],
    [['m', 1, 2], 'm[1][2]'],
  ] as [PropertyKey[], string][])('writes %j as %s', (path, written) => {
    expect(issuePath(path)).toBe(written);
  });
});

describe('issueLine', () => {
  it('is the path, a colon and a space, then the message', () => {
    expect(issueLine({ path: 'a[0]', message: 'bad' })).toBe('a[0]: bad');
  });
});

describe('notJsonIssue', () => {
  it('is about the whole share, giving where the error is', () => {
    expect(notJsonIssue('{"a":1} x')).toEqual({
      path: WHOLE_SHARE,
      message: 'not JSON: the error is at position 8 (line 1, column 9)',
    });
  });

  it('says text that stops early ends too soon', () => {
    expect(notJsonIssue('{"a":\n').message).toBe(
      'not JSON: it ends too soon, at position 6 (line 2, column 1)',
    );
  });

  it('says so when it cannot place the error', () => {
    expect(notJsonIssue('['.repeat(100_000)).message).toBe(
      'not JSON: the error could not be placed',
    );
  });

  // V8 quotes the input around the error; with an odd number of quotes in
  // its snippet, cutting quoted runs left part of the secret behind.
  it.each([
    ['an unquoted secret', '{"k":"v","t": ghp_SECRET"x"}'],
    [
      'unpaired quotes',
      '{"aaaaaaaaaaaaaaaaaaaaaaaa":"bb", "t": ghp_SECRET"x""}',
    ],
    ['the secret alone', 'ghp_SECRET'],
    ['a secret in an unterminated string', '{"t":"ghp_SECRET'],
  ])('keeps no input text with %s', (_why, text) => {
    const { message } = notJsonIssue(text);
    expect(message).toMatch(/^not JSON: /);
    for (const piece of ['ghp', 'SECRET', '"', 'aaa', 'bb'])
      expect(message).not.toContain(piece);
  });
});
