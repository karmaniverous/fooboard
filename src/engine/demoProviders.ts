/**
 * Query providers for the demo board (spec.md C-23): every credential id
 * resolves to the demo GitHub or Amplify provider, sharing one clock so
 * the board progresses consistently. The demo has its own QueryClient,
 * never persisted.
 *
 * @module
 */
import { createDemoAmplifyReaderFor } from '@/demo/amplify';
import { createDemoGitHubApi } from '@/demo/github';
import { getOrCreate } from '@/lib/memo';
import type { ProviderHooks } from '@/query/client';
import type { QueryProviders } from '@/query/fetchers';

/** The fingerprint of every demo credential (its secret never changes). */
const DEMO_FINGERPRINT = 'demo';

/** Providers answering from the demo scenarios. */
export function demoProviders(
  hooks: ProviderHooks,
  clock: () => number = Date.now,
): QueryProviders {
  const amplify = createDemoAmplifyReaderFor(clock);
  const github = new Map<string, ReturnType<typeof createDemoGitHubApi>>();
  return {
    github: (id) =>
      getOrCreate(github, id, () =>
        createDemoGitHubApi(clock, (budget) => {
          hooks.onBudget(id, budget);
        }),
      ),
    amplify: () => amplify,
    fingerprint: () => DEMO_FINGERPRINT,
  };
}
