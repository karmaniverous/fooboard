/**
 * Tests for the Amplify SDK client the reader builds (spec.md §3.1,
 * Decision 21): one SDK attempt per call, so a throttle reaches the
 * limiter (which waits AWS's suggested delay) instead of the SDK retrying
 * behind its back; the key's region and secret go to the client, which
 * sends each signed request through the transport's `fetch` (§3.14).
 *
 * @module
 */
import type * as AmplifySdk from '@aws-sdk/client-amplify';
import { FetchHttpHandler } from '@smithy/fetch-http-handler';
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
        requestHandler: expect.any(FetchHttpHandler) as unknown,
      },
    ]);
  });

  it("sends the SDK's signed requests through the given fetch", async () => {
    const sent: Request[] = [];
    const fetch: typeof globalThis.fetch = (input, init) => {
      sent.push(new Request(input, init));
      return Promise.resolve(
        new Response(JSON.stringify({ apps: [] }), {
          headers: { 'content-type': 'application/json' },
        }),
      );
    };
    const reader = createAmplifyReader({
      region: 'eu-west-1',
      accessKeyId: 'AKIA',
      secretAccessKey: 'secret',
      fetch,
    });
    expect(await reader.listApps()).toEqual([]);
    expect(sent.map((r) => new URL(r.url).host)).toEqual([
      'amplify.eu-west-1.amazonaws.com',
    ]);
    expect(sent[0]?.headers.get('authorization')).toMatch(
      /^AWS4-HMAC-SHA256 Credential=AKIA\//,
    );
  });
});
