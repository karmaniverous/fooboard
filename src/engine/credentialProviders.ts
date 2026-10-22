/**
 * Query providers backed by the credential store (spec.md §3.1, C-5,
 * C-6): each GitHub token gets one request port reporting its budget,
 * and each AWS key one reader per region it reads. Requests in flight are
 * the query layer's limiter's business, not the readers'. Readers are
 * rebuilt when a secret changes; a missing secret yields `undefined`
 * (*needs credential*).
 *
 * @module
 */
import { createAmplifyReader } from '@/lib/amplify/reader';
import type { AmplifyReaderFor } from '@/lib/amplify/rowJobs';
import { createGitHubApi, type GitHubApi } from '@/lib/github';
import type { ProviderHooks } from '@/query/client';
import type { QueryProviders } from '@/query/fetchers';
import type {
  CredentialSecret,
  CredentialStore,
} from '@/storage/credentialStore';

/** A secret's fingerprint: changes whenever the secret does. */
const fingerprintOf = (secret: CredentialSecret | undefined) =>
  secret ? JSON.stringify(secret) : undefined;

/** Build a value from a secret once, rebuilding when the secret changes. */
function cachedBySecret<T>(
  store: CredentialStore,
  build: (id: string, secret: CredentialSecret) => T | undefined,
): (id: string) => T | undefined {
  const cache = new Map<
    string,
    { fingerprint: string; value: T | undefined }
  >();
  return (id) => {
    const secret = store.get(id);
    const fingerprint = fingerprintOf(secret);
    if (!secret || fingerprint === undefined) return undefined;
    const hit = cache.get(id);
    if (hit?.fingerprint === fingerprint) return hit.value;
    const value = build(id, secret);
    cache.set(id, { fingerprint, value });
    return value;
  };
}

export function credentialProviders(
  store: CredentialStore,
  hooks: ProviderHooks,
): QueryProviders {
  const github = cachedBySecret<GitHubApi>(store, (id, secret) =>
    secret.kind === 'github'
      ? createGitHubApi({
          token: secret.token,
          onBudget: (budget) => {
            hooks.onBudget(id, budget);
          },
        })
      : undefined,
  );

  const amplify = cachedBySecret<AmplifyReaderFor>(store, (_id, secret) => {
    if (secret.kind !== 'aws') return undefined;
    const byRegion = new Map<string, ReturnType<typeof createAmplifyReader>>();
    return ({ region }) => {
      let reader = byRegion.get(region);
      if (!reader) {
        reader = createAmplifyReader({
          region,
          accessKeyId: secret.accessKeyId,
          secretAccessKey: secret.secretAccessKey,
        });
        byRegion.set(region, reader);
      }
      return reader;
    };
  });

  return {
    github,
    amplify,
    fingerprint: (id) => fingerprintOf(store.get(id)),
  };
}
