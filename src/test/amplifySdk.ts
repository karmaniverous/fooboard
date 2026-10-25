/**
 * A real Amplify SDK client whose requests get a canned HTTP answer, so
 * tests see the error (or data) the SDK itself makes of what AWS sends,
 * signing and parsing included; or none, until the request is aborted.
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

/** The SDK's HTTP handler, as a test supplies it. */
type Handle = (
  request: unknown,
  options?: { abortSignal?: Pick<AbortSignal, 'aborted' | 'onabort'> },
) => Promise<{ response: CannedResponse }>;

/** What a handler answers with. */
interface CannedResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: Uint8Array;
}

/** An Amplify reader in `region` over the real SDK, its requests
 * answered by `handle`. */
function sdkReader(region: string, handle: Handle): AmplifyReader {
  const client = new AmplifyClient({
    region,
    credentials: TEST_KEY,
    maxAttempts: 1,
    requestHandler: { handle },
  });
  return createAmplifyReader({ region, ...TEST_KEY, client });
}

/** An Amplify reader in `region` over the real SDK, every request
 * answered with `answer`. */
export const cannedReader = (
  region: string,
  answer: CannedAnswer,
): AmplifyReader =>
  sdkReader(region, () =>
    Promise.resolve({
      response: {
        statusCode: answer.statusCode,
        headers: { 'content-type': 'application/json', ...answer.headers },
        body: Uint8Array.from(
          new TextEncoder().encode(JSON.stringify(answer.body)),
        ),
      },
    }),
  );

/** The requests a silent region was sent, and how many were aborted. */
export interface SilentTally {
  sent: number;
  aborted: number;
}

/** An Amplify reader in `region` over the real SDK whose requests never
 * answer: each fails only when the SDK aborts it, as a browser's fetch
 * does, counted in `tally`. */
export const silentReader = (
  region: string,
  tally: SilentTally,
): AmplifyReader =>
  sdkReader(
    region,
    (_, options) =>
      new Promise((_resolve, reject) => {
        tally.sent += 1;
        const signal = options?.abortSignal;
        if (signal)
          signal.onabort = () => {
            tally.aborted += 1;
            reject(new DOMException('aborted', 'AbortError'));
          };
      }),
  );
