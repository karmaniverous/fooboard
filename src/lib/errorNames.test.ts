/**
 * Tests that the adapters' error names survive a production build: the
 * editors and alerts show `describeError` (name and message), and
 * minification renames classes, so each name must be a literal, not the
 * constructor's name. Each case renames the class as a minifier would.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import {
  AmplifyAuthError,
  AmplifyNotFoundError,
  AmplifyThrottledError,
} from './amplify/errors';
import { describeError } from './errors';
import {
  GitHubAuthError,
  GitHubForbiddenError,
  GitHubHttpError,
  GitHubNetworkError,
  GitHubNotFoundError,
  GitHubValidationError,
  RateLimitedError,
} from './github/errors';

const PATH = '/repos/acme/api-core/actions/runs';

const cases: [string, abstract new (...args: never[]) => Error, () => Error][] =
  [
    ['GitHubAuthError', GitHubAuthError, () => new GitHubAuthError(PATH)],
    [
      'GitHubForbiddenError',
      GitHubForbiddenError,
      () => new GitHubForbiddenError(PATH),
    ],
    [
      'GitHubNotFoundError',
      GitHubNotFoundError,
      () => new GitHubNotFoundError(PATH),
    ],
    [
      'GitHubNetworkError',
      GitHubNetworkError,
      () => new GitHubNetworkError(PATH),
    ],
    ['RateLimitedError', RateLimitedError, () => new RateLimitedError(PATH, 0)],
    [
      'GitHubValidationError',
      GitHubValidationError,
      () => new GitHubValidationError(PATH, 'bad'),
    ],
    ['GitHubHttpError', GitHubHttpError, () => new GitHubHttpError(PATH, 502)],
    [
      'AmplifyNotFoundError',
      AmplifyNotFoundError,
      () => new AmplifyNotFoundError('gone', 'getApp'),
    ],
    [
      'AmplifyAuthError',
      AmplifyAuthError,
      () => new AmplifyAuthError('denied', 'getApp'),
    ],
    [
      'AmplifyThrottledError',
      AmplifyThrottledError,
      () => new AmplifyThrottledError('slow', 'getApp', 5),
    ],
  ];

describe('adapter error names', () => {
  it.each(cases)(
    '%s keeps its name when its class is renamed',
    (name, cls, make) => {
      const original = Object.getOwnPropertyDescriptor(cls, 'name');
      Object.defineProperty(cls, 'name', { value: 'm' });
      try {
        const err = make();
        expect(err.name).toBe(name);
        expect(describeError(err)).toBe(`${name}: ${err.message}`);
      } finally {
        if (original) Object.defineProperty(cls, 'name', original);
      }
    },
  );
});
