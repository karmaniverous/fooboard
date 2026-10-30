/**
 * Tests for field-level import errors' paths and lines (spec 0.2.0 §3.J
 * *Paths*): zod's path written for a reader, the whole share written
 * `share`, and a parser's quoted text cut from its message.
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
  it("is about the whole share, with the parser's message", () => {
    expect(
      notJsonIssue(new SyntaxError('Unexpected end of JSON input')),
    ).toEqual({
      path: WHOLE_SHARE,
      message: 'not JSON: Unexpected end of JSON input',
    });
  });

  it('cuts the text a parser quotes, which could hold a secret', () => {
    let error: unknown;
    try {
      JSON.parse('ghp_secret');
    } catch (err) {
      error = err;
    }
    const { message } = notJsonIssue(error);
    expect(message).toMatch(/^not JSON: /);
    expect(message).not.toContain('ghp_secret');
  });

  it('cuts quoted text with escaped quotes inside it', () => {
    expect(
      notJsonIssue(new Error('Unexpected token "a\\"b" here')).message,
    ).toBe('not JSON: Unexpected token "…" here');
  });
});
