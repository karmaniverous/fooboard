/**
 * Tests for `refreshAmplifyRow`'s failure handling: a missing credential,
 * a rejected one, throttling (keep previous cells) and other errors.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import type { AmplifyRow } from '@/domain/config/row';
import { AmplifyAuthError, AmplifyThrottledError } from '@/lib/amplify/errors';
import type { AmplifyReader } from '@/lib/amplify/reader';

import { refreshAmplifyRow } from './amplifyRow';

const row: AmplifyRow = {
  type: 'amplify',
  id: 'site',
  repo: 'acme/site',
  displayName: 'site',
  sources: [{ credentialId: 'aws', region: 'us-east-1', appId: 'a1' }],
};
const stages = [{ id: 'prod', name: 'Prod', branchPattern: 'main' }];

const failing = (err: Error) => () =>
  ({
    listApps: () => Promise.reject(err),
    listBranches: () => Promise.reject(err),
    listJobs: () => Promise.reject(err),
    getJob: () => Promise.reject(err),
  }) satisfies AmplifyReader;

describe('refreshAmplifyRow', () => {
  it('shows needs credential when the key is missing', async () => {
    const result = await refreshAmplifyRow(row, stages, () => undefined);
    expect(result).toMatchObject({
      kind: 'refreshed',
      cells: { prod: { kind: 'empty', state: 'needs-credential' } },
    });
  });

  it('shows needs credential when AWS rejects the key', async () => {
    const result = await refreshAmplifyRow(row, stages, () =>
      failing(new AmplifyAuthError('denied', 'ListBranches')),
    );
    expect(result).toMatchObject({
      cells: { prod: { state: 'needs-credential' } },
    });
  });

  it('keeps the previous cells while throttled', async () => {
    const result = await refreshAmplifyRow(row, stages, () =>
      failing(new AmplifyThrottledError('slow down', 'ListBranches', 5_000)),
    );
    expect(result).toEqual({ kind: 'rate-limited' });
  });

  it('shows error with the reason for other failures', async () => {
    const result = await refreshAmplifyRow(row, stages, () =>
      failing(new Error('socket hang up')),
    );
    expect(result).toMatchObject({
      cells: { prod: { kind: 'empty', state: 'error' } },
    });
  });
});
