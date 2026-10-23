/**
 * Test query environments: a real QueryClient, limiters and budget store
 * over fake providers (one GitHub port and one Amplify reader for every
 * credential, unless a test gives per-credential ones), and a wrapper
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
  fingerprint?: (id: string) => string | undefined;
}

/** A query environment over fakes. `budgets` lets a test report budgets
 * as if from responses. */
export function testQueryEnv(
  providers: TestProviders = {},
  options: { now?: () => number } = {},
): QueryEnv & { report: (id: string, budget: RateLimitBudget) => void } {
  let report: (id: string, budget: RateLimitBudget) => void = () => undefined;
  const env = createQueryEnv({
    ...options,
    providers: (hooks) => {
      report = (id, budget) => {
        hooks.onBudget(id, budget);
      };
      return {
        github: providers.github ?? (() => fakeGitHubApi()),
        amplify: (id) => {
          const reader = providers.amplify
            ? providers.amplify(id)
            : fakeAmplifyReader();
          return reader ? () => reader : undefined;
        },
        fingerprint: providers.fingerprint ?? (() => 'secret'),
      };
    },
  });
  return {
    ...env,
    report: (id, budget) => {
      report(id, budget);
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
