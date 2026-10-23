/**
 * Test query environments: a real QueryClient, limiters and budget store
 * over fake providers (one GitHub port and one Amplify reader for every
 * credential, unless a test gives per-credential or per-region ones), and
 * a wrapper
 * providing it to components.
 *
 * @module
 */
import type { AmplifyReader } from '@/lib/amplify/reader';
import type { GitHubApi, RateLimitBudget } from '@/lib/github';
import { createQueryEnv, type QueryEnv } from '@/query/client';
import { QueryProvider } from '@/query/QueryProvider';

import { fakeAmplifyReader, fakeGitHubApi } from './fakeReaders';

export interface TestProviders {
  /** The GitHub port per credential id; `undefined`: no secret. */
  github?: (id: string) => GitHubApi | undefined;
  amplify?: (id: string) => AmplifyReader | undefined;
  /** The Amplify reader per region (every credential); beats `amplify`. */
  amplifyIn?: (region: string) => AmplifyReader;
  fingerprint?: (id: string) => string | undefined;
}

/** Report a budget as if from a response read with the secret whose
 * fingerprint is `readWith` (by default the credential's current one). */
type Report = (id: string, budget: RateLimitBudget, readWith?: string) => void;

/** A query environment over fakes. `report` lets a test report budgets
 * as if from responses. */
export function testQueryEnv(
  providers: TestProviders = {},
  options: { now?: () => number } = {},
): QueryEnv & { report: Report } {
  let report: Report = () => undefined;
  const fingerprint = providers.fingerprint ?? (() => 'secret');
  const env = createQueryEnv({
    ...options,
    providers: (hooks) => {
      report = (id, budget, readWith = fingerprint(id)) => {
        hooks.onBudget(id, budget, readWith);
      };
      return {
        github: providers.github ?? (() => fakeGitHubApi()),
        amplify: (id) => {
          const { amplifyIn } = providers;
          if (amplifyIn) return ({ region }) => amplifyIn(region);
          const reader = providers.amplify
            ? providers.amplify(id)
            : fakeAmplifyReader();
          return reader ? () => reader : undefined;
        },
        fingerprint,
      };
    },
  });
  return {
    ...env,
    report: (id, budget, readWith) => {
      report(id, budget, readWith);
    },
  };
}

/** A component providing an environment to its children. */
type EnvWrapper = (props: { children: React.ReactNode }) => React.JSX.Element;

/** `children` with `env` provided. */
export function withEnv(env: QueryEnv): EnvWrapper {
  return function Wrapper({
    children,
  }: {
    children: React.ReactNode;
  }): React.JSX.Element {
    return <QueryProvider env={env}>{children}</QueryProvider>;
  };
}
