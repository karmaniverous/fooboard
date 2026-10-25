/**
 * Raw requests to the simulator for request-surface tests (spec.md §3.14):
 * GitHub requests with a token, Amplify requests with a SigV4-shaped
 * `Authorization` header naming a key, at a test clock, and a response's
 * JSON body, parsed by the given schema (the readers' own where they
 * have one).
 *
 * @module
 */
import type { z } from 'zod';

import type { DemoScenario } from '@/demo/sim/scenario';
import { createSimulator, type Wait } from '@/demo/sim/simulator';
import { GITHUB_API_BASE, type Transport } from '@/lib/transport';

import { TINY_KEY_ID, TINY_TOKEN, tinyScenario } from './simScenario';

/** The test clock's wall time at the opening. */
export const SIM_HTTP_EPOCH = Date.UTC(2026, 9, 25, 12);

/** A response's JSON body, parsed by `schema`. */
export const bodyOf = async <T>(
  res: Response,
  schema: z.ZodType<T>,
): Promise<T> => {
  const data: unknown = await res.json();
  return schema.parse(data);
};

/** A response's JSON body, unparsed (for `toMatchObject`). */
export const rawBody = async (res: Response): Promise<unknown> => {
  const data: unknown = await res.json();
  return data;
};

/** A simulator at a movable test clock, with raw request helpers. */
export interface SimHttp {
  transport: Transport;
  /** Move the clock to `ms` after the opening. */
  at: (ms: number) => void;
  /** GET a GitHub API path with a token (none for `null`). */
  github: (
    path: string,
    token?: string | null,
    headers?: Record<string, string>,
  ) => Promise<Response>;
  /** GET an Amplify path in `region`, signed as by key `keyId`. */
  amplify: (path: string, keyId?: string, region?: string) => Promise<Response>;
}

export function simHttp(
  scenario: DemoScenario = tinyScenario(),
  wait: Wait = () => Promise.resolve(),
): SimHttp {
  let rel = 0;
  const transport = createSimulator(scenario, {
    clock: () => SIM_HTTP_EPOCH + rel,
    wait,
  });
  return {
    transport,
    at: (ms) => {
      rel = ms;
    },
    github: (path, token = TINY_TOKEN, headers = {}) =>
      transport.fetch(`${GITHUB_API_BASE}${path}`, {
        headers: {
          ...(token ? { authorization: `Bearer ${token}` } : {}),
          ...headers,
        },
      }),
    amplify: (path, keyId = TINY_KEY_ID, region = 'us-east-1') =>
      transport.fetch(`https://amplify.${region}.amazonaws.com${path}`, {
        headers: {
          authorization: `AWS4-HMAC-SHA256 Credential=${keyId}/20261025/${region}/amplify/aws4_request, SignedHeaders=host, Signature=x`,
        },
      }),
  };
}
