/**
 * What a row shows after a provider call fails (spec.md §4.3.5), shared by
 * the GitHub and Amplify row refreshers: rate limiting keeps the previous
 * cells, a rejected credential shows *needs credential*, and anything else
 * shows *error* with its reason.
 *
 * @module
 */
import type { CredentialStatus, ProviderFailure } from '@/domain/derivation';
import { describeError } from '@/lib/errors';

/** How a failed refresh should render. */
export type FailureOutcome =
  | { kind: 'rate-limited' }
  | {
      kind: 'empty';
      credentialStatus: CredentialStatus;
      providerFailure?: ProviderFailure;
    };

/** Classify `err` with the provider's own error tests. */
export function failureOutcome(
  err: unknown,
  {
    isRateLimit,
    isAuth,
  }: {
    isRateLimit: (err: unknown) => boolean;
    isAuth: (err: unknown) => boolean;
  },
): FailureOutcome {
  if (isRateLimit(err)) return { kind: 'rate-limited' };
  if (isAuth(err)) return { kind: 'empty', credentialStatus: 'expired' };
  return {
    kind: 'empty',
    credentialStatus: 'ok',
    providerFailure: { message: describeError(err), isRateLimit: false },
  };
}
