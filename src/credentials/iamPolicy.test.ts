/**
 * Documentation check for the guide's IAM policy: exactly the four
 * read-only actions fooboard calls, each scoped to the resource type AWS
 * supports for it, and no write action.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { IAM_POLICY } from './iamPolicy';

const scopeOf = (action: string) =>
  IAM_POLICY.Statement.find((s) =>
    (s.Action as readonly string[]).includes(action),
  )?.Resource;

describe('IAM_POLICY', () => {
  it('allows only the read actions fooboard uses', () => {
    expect(IAM_POLICY.Statement.flatMap((s) => s.Action).sort()).toEqual([
      'amplify:GetJob',
      'amplify:ListApps',
      'amplify:ListBranches',
      'amplify:ListJobs',
    ]);
    expect(new Set(IAM_POLICY.Statement.map((s) => s.Effect))).toEqual(
      new Set(['Allow']),
    );
  });

  it('scopes each action to the resource type AWS supports for it', () => {
    expect(scopeOf('amplify:ListApps')).toBe('*');
    expect(scopeOf('amplify:ListBranches')).toEqual([
      expect.stringMatching(/^arn:aws:amplify:[^:]+:\d{12}:apps\/[^/]+$/),
    ]);
    expect(scopeOf('amplify:ListJobs')).toEqual([
      expect.stringMatching(/:apps\/[^/]+\/branches\/\*$/),
    ]);
    expect(scopeOf('amplify:GetJob')).toEqual([
      expect.stringMatching(/:apps\/[^/]+\/branches\/\*\/jobs\/\*$/),
    ]);
  });
});
