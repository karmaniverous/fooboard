/**
 * A real Amplify SDK client whose requests get a canned HTTP answer, so
 * tests see the error (or data) the SDK itself makes of what AWS sends,
 * signing and parsing included.
 *
 * @module
 */
import { AmplifyClient } from '@aws-sdk/client-amplify';

import { type AmplifyReader, createAmplifyReader } from '@/lib/amplify/reader';

/** Credentials the canned client signs with (never sent anywhere). */
const TEST_KEY = { accessKeyId: 'AKIATEST', secretAccessKey: 'test' };

/** An HTTP answer, its body JSON. */
export interface CannedAnswer {
  statusCode: number;
  headers?: Record<string, string>;
  body: unknown;
}

/** What a browser reads when an opt-in region the account hasn't enabled
 * rejects the key (the real board's check of 2026-10-25): a 403 whose
 * error type CORS hides, so only its message is readable. */
export const OPT_IN_REJECTION: CannedAnswer = {
  statusCode: 403,
  body: { message: 'The security token included in the request is invalid.' },
};

/** An Amplify reader in `region` over the real SDK, every request
 * answered with `answer`. */
export function cannedReader(
  region: string,
  answer: CannedAnswer,
): AmplifyReader {
  const client = new AmplifyClient({
    region,
    credentials: TEST_KEY,
    maxAttempts: 1,
    requestHandler: {
      handle: () =>
        Promise.resolve({
          response: {
            statusCode: answer.statusCode,
            headers: {
              'content-type': 'application/json',
              ...answer.headers,
            },
            body: Uint8Array.from(
              new TextEncoder().encode(JSON.stringify(answer.body)),
            ),
          },
        }),
    },
  });
  return createAmplifyReader({ region, ...TEST_KEY, client });
}
