/**
 * Query providers backed by the credential store (spec.md §3.1, C-5,
 * C-6): each GitHub token gets one request port reporting its budget,
 * and each AWS key one reader per region it reads. Requests in flight are
 * the query layer's limiter's business, not the readers'. Readers are
 * rebuilt when a secret changes; a missing secret yields `undefined`
 * (*needs credential*). Every reader sends through `transport`: the
 * browser's on a real board, the simulator's in the demo (§3.14).
 *
 * @module
 */
import { createAmplifyReader } from '@/lib/amplify/reader';
import type { AmplifyReaderFor } from '@/lib/amplify/rowJobs';
import { fingerprintOf } from '@/lib/fingerprint';
import { createGitHubApi, type GitHubApi } from '@/lib/github';
import { getOrCreate } from '@/lib/memo';
import { browserTransport, type Transport } from '@/lib/transport';
import type { ProviderHooks } from '@/query/client';
import type { QueryProviders } from '@/query/fetchers';
import type {
  CredentialSecret,
  CredentialStore,
} from '@/storage/credentialStore';

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
  transport: Transport = browserTransport,
): QueryProviders {
  const github = cachedBySecret<GitHubApi>(store, (id, secret) =>
    secret.kind === 'github'
      ? createGitHubApi({
          token: secret.token,
          fetchImpl: transport.fetch,
          apiBase: transport.githubApiBase,
          // Tagged with the secret it was read with (fooboard#24).
          onBudget: (budget) => {
            hooks.onBudget(id, budget, fingerprintOf(secret));
          },
        })
      : undefined,
  );

  const amplify = cachedBySecret<AmplifyReaderFor>(store, (_id, secret) => {
    if (secret.kind !== 'aws') return undefined;
    const byRegion = new Map<string, ReturnType<typeof createAmplifyReader>>();
    return ({ region }) =>
      getOrCreate(byRegion, region, () =>
        createAmplifyReader({
          region,
          accessKeyId: secret.accessKeyId,
          secretAccessKey: secret.secretAccessKey,
          fetch: transport.fetch,
        }),
      );
  });

  return {
    github,
    amplify,
    fingerprint: (id) => store.fingerprint(id),
  };
}
