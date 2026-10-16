/**
 * Tests for the typed GitHub errors: correct subclassing, `isNeedsCredential`,
 * and that no error message embeds a token (tokens are never passed to these
 * constructors in the first place, but the messages are checked anyway as a
 * contract test for anyone extending them).
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import {
  GitHubAuthError,
  GitHubForbiddenError,
  GitHubHttpError,
  GitHubNetworkError,
  GitHubNotFoundError,
  GitHubValidationError,
  isNeedsCredential,
  RateLimitedError,
} from './errors';

const SECRET_TOKEN = 'github_pat_SUPER_SECRET_VALUE';

describe('GitHub typed errors', () => {
  it('GitHubAuthError maps to needs-credential', () => {
    const err = new GitHubAuthError('https://api.github.com/repos/o/r');
    expect(isNeedsCredential(err)).toBe(true);
    expect(err.message).not.toContain(SECRET_TOKEN);
  });

  it('other errors do not map to needs-credential', () => {
    expect(isNeedsCredential(new GitHubForbiddenError('p'))).toBe(false);
    expect(isNeedsCredential(new GitHubNotFoundError('p'))).toBe(false);
    expect(isNeedsCredential(new Error('p'))).toBe(false);
  });

  it('GitHubNetworkError keeps the cause without embedding it in message text', () => {
    const cause = new TypeError('fetch failed');
    const err = new GitHubNetworkError('https://api.github.com/x', cause);
    expect(err.cause).toBe(cause);
    expect(err.message).not.toContain(SECRET_TOKEN);
  });

  it('GitHubValidationError includes the schema issues', () => {
    const err = new GitHubValidationError(
      'https://api.github.com/x',
      'expected string',
    );
    expect(err.message).toContain('expected string');
  });

  it('no error message ever contains a token value', () => {
    const errors = [
      new GitHubAuthError('p'),
      new GitHubForbiddenError('p'),
      new GitHubNotFoundError('p'),
      new GitHubNetworkError('p'),
      new RateLimitedError('p', Date.now()),
      new GitHubValidationError('p', 'bad'),
      new GitHubHttpError('p', 500),
    ];
    for (const err of errors) expect(err.message).not.toContain(SECRET_TOKEN);
  });
});
