/**
 * Building a share (spec.md §3.8): the chosen dashboards exactly as
 * stored and, only when the user includes them, the secrets this device
 * holds for the credentials those dashboards reference, plain or
 * encrypted under a passphrase. Device preferences, the query cache and
 * session state are never part of it.
 *
 * @module
 */
import type { Dashboard } from '@/domain/config/dashboard';
import type { CredentialSecret } from '@/storage/credentialStore';

import { buildEnvelope, type ShareEnvelope } from './envelope';
import {
  encryptSecrets,
  SHARE_PBKDF2_ITERATIONS,
  type ShareSecrets,
} from './secrets';

/** Whether to include secrets, and how. */
export type CredentialsChoice =
  | { include: false }
  /** `passphrase` `null`: plain. */
  | { include: true; passphrase: string | null };

/** The secrets this device holds for the credentials `dashboards`
 * reference (one of the wrong kind is left out). */
export function secretsOf(
  dashboards: readonly Dashboard[],
  get: (id: string) => CredentialSecret | undefined,
): ShareSecrets {
  return Object.fromEntries(
    dashboards.flatMap((d) =>
      d.credentials.flatMap((ref) => {
        const secret = get(ref.id);
        return secret?.kind === ref.kind ? [[ref.id, secret] as const] : [];
      }),
    ),
  );
}

/** The share for `dashboards`. */
export async function makeShare(
  dashboards: Dashboard[],
  choice: CredentialsChoice,
  get: (id: string) => CredentialSecret | undefined,
  iterations: number = SHARE_PBKDF2_ITERATIONS,
): Promise<ShareEnvelope> {
  if (!choice.include) return buildEnvelope(dashboards, null);
  const secrets = secretsOf(dashboards, get);
  return buildEnvelope(
    dashboards,
    choice.passphrase === null
      ? { encrypted: false, secrets }
      : await encryptSecrets(secrets, choice.passphrase, iterations),
  );
}

/** A file name for a share of `dashboards`. */
export function shareFileName(dashboards: readonly Dashboard[]): string {
  const only = dashboards.length === 1 ? dashboards[0] : undefined;
  const slug = only?.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `fooboard-${slug || `${String(dashboards.length)}-dashboards`}.json`;
}
