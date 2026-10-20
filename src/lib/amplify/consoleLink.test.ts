/**
 * Tests for `buildAmplifyConsoleLink`, including slashed branch names
 * (e.g. `preview/bali`), which must be URL-encoded as a single path
 * segment.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { buildAmplifyConsoleLink } from './consoleLink';

describe('buildAmplifyConsoleLink', () => {
  it('composes a link for a literal branch', () => {
    expect(
      buildAmplifyConsoleLink({
        region: 'us-east-1',
        appId: 'd1a2b3c4d5e6f7',
        branch: 'main',
        jobId: '42',
      }),
    ).toBe(
      'https://us-east-1.console.aws.amazon.com/amplify/apps/d1a2b3c4d5e6f7/branches/main/deployments/42',
    );
  });

  it('URL-encodes a slashed branch name as one path segment', () => {
    expect(
      buildAmplifyConsoleLink({
        region: 'us-west-2',
        appId: 'd9z8y7x6w5v4u3',
        branch: 'preview/bali',
        jobId: '7',
      }),
    ).toBe(
      'https://us-west-2.console.aws.amazon.com/amplify/apps/d9z8y7x6w5v4u3/branches/preview%2Fbali/deployments/7',
    );
  });

  it('encodes other reserved characters in branch names', () => {
    expect(
      buildAmplifyConsoleLink({
        region: 'eu-central-1',
        appId: 'app123',
        branch: 'release/24.3 rc1',
        jobId: '1',
      }),
    ).toBe(
      'https://eu-central-1.console.aws.amazon.com/amplify/apps/app123/branches/release%2F24.3%20rc1/deployments/1',
    );
  });
});
