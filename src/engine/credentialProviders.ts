/**
 * Engine providers backed by the credential store (spec.md C-5, C-6): each
 * GitHub credential gets one reader, and each AWS key one serial queue
 * shared by its readers in every region, so one key never has more than
 * one Amplify request in flight (spec.md §5). Readers are rebuilt when a
 * secret changes; a missing secret yields `undefined` (*needs credential*).
 *
 * @module
 */
import { createAmplifyReader } from '@/lib/amplify/reader';
import type { AmplifyReaderFor } from '@/lib/amplify/rowJobs';
import { createGitHubReader, type GitHubReader } from '@/lib/github/reader';
import { SerialQueue } from '@/lib/queue/serialQueue';
import type {
  CredentialSecret,
  CredentialStore,
} from '@/storage/credentialStore';

import type { EngineProviders } from './types';

/** Build a value from a secret once, rebuilding when the secret changes. */
function cachedBySecret<T>(
  store: CredentialStore,
  build: (secret: CredentialSecret) => T | undefined,
): (id: string) => T | undefined {
  const cache = new Map<
    string,
    { fingerprint: string; value: T | undefined }
  >();
  return (id) => {
    const secret = store.get(id);
    if (!secret) return undefined;
    const fingerprint = JSON.stringify(secret);
    const hit = cache.get(id);
    if (hit?.fingerprint === fingerprint) return hit.value;
    const value = build(secret);
    cache.set(id, { fingerprint, value });
    return value;
  };
}

export function credentialProviders(store: CredentialStore): EngineProviders {
  const github = cachedBySecret<GitHubReader>(store, (secret) =>
    secret.kind === 'github'
      ? createGitHubReader({ token: secret.token })
      : undefined,
  );

  const amplify = cachedBySecret<AmplifyReaderFor>(store, (secret) => {
    if (secret.kind !== 'aws') return undefined;
    const queue = new SerialQueue();
    const byRegion = new Map<string, ReturnType<typeof createAmplifyReader>>();
    return ({ region }) => {
      let reader = byRegion.get(region);
      if (!reader) {
        reader = createAmplifyReader({
          region,
          queue,
          accessKeyId: secret.accessKeyId,
          secretAccessKey: secret.secretAccessKey,
        });
        byRegion.set(region, reader);
      }
      return reader;
    };
  });

  return { github, amplify };
}
