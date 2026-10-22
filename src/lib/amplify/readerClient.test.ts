/**
 * Tests for the Amplify SDK client the reader builds (spec.md §3.1,
 * Decision 21): one SDK attempt per call, so a throttle reaches the
 * limiter (which waits AWS's suggested delay) instead of the SDK retrying
 * behind its back; the key's region and secret go to the client.
 *
 * @module
 */
import type * as AmplifySdk from '@aws-sdk/client-amplify';
import { describe, expect, it, vi } from 'vitest';

const built = vi.hoisted(() => [] as unknown[]);

vi.mock('@aws-sdk/client-amplify', async (importOriginal) => {
  const sdk = await importOriginal<typeof AmplifySdk>();
  class RecordingClient extends sdk.AmplifyClient {
    constructor(...args: ConstructorParameters<typeof sdk.AmplifyClient>) {
      super(...args);
      built.push(args[0]);
    }
  }
  return { ...sdk, AmplifyClient: RecordingClient };
});

const { createAmplifyReader } = await import('./reader');

describe('createAmplifyReader client', () => {
  it('builds the SDK client with one attempt, for the key’s region', () => {
    createAmplifyReader({
      region: 'eu-west-1',
      accessKeyId: 'AKIA',
      secretAccessKey: 'secret',
    });
    expect(built).toEqual([
      {
        region: 'eu-west-1',
        credentials: { accessKeyId: 'AKIA', secretAccessKey: 'secret' },
        maxAttempts: 1,
      },
    ]);
  });
});
