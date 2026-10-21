/**
 * Development aid (spec.md §3.5): wrap every request an engine's providers
 * make, without changing what they return. Each GitHub reader method and
 * each Amplify reader method is one *request* here (one logical read, as
 * the engine awaits it), described by a {@link RequestCall} so a wrapper
 * can time it, delay it or attribute it to the rows that needed it. Used
 * by the timing session and by the demo's simulated latency.
 *
 * @module
 */
import type { Provider } from '@/domain/config/providers';
import type { EngineProviders } from '@/engine/types';
import type { AmplifyReader } from '@/lib/amplify/reader';
import type { AmplifyReaderFor } from '@/lib/amplify/rowJobs';
import type { GitHubReader, RepoRef } from '@/lib/github/reader';

/** What a request reads, enough to name it and find the rows needing it. */
export interface RequestCall {
  provider: Provider;
  /** The reader method, e.g. `listWorkflowRuns` or `listJobs`. */
  kind: string;
  credentialId: string;
  /** GitHub: the repo read (`owner/name`); none for account-wide reads. */
  repo?: string;
  /** Amplify: the region and app read. */
  region?: string;
  appId?: string;
}

/** Runs one request: call `run` (once) and settle as it does. */
export type Around = <T>(
  call: RequestCall,
  run: () => Promise<T>,
) => Promise<T>;

const repoName = ({ owner, repo }: RepoRef): string => `${owner}/${repo}`;

/** `reader` with every request passed through `around`. */
function wrapGitHubReader(
  reader: GitHubReader,
  credentialId: string,
  around: Around,
): GitHubReader {
  const call = (kind: string, ref?: RepoRef): RequestCall => ({
    provider: 'github',
    kind,
    credentialId,
    ...(ref ? { repo: repoName(ref) } : {}),
  });
  return {
    listWorkflowRuns: (ref, opts) =>
      around(call('listWorkflowRuns', ref), () =>
        reader.listWorkflowRuns(ref, opts),
      ),
    listRunJobs: (ref, runId, opts) =>
      around(call('listRunJobs', ref), () =>
        reader.listRunJobs(ref, runId, opts),
      ),
    listWorkflows: (ref) =>
      around(call('listWorkflows', ref), () => reader.listWorkflows(ref)),
    matchingRefs: (ref, prefix) =>
      around(call('matchingRefs', ref), () => reader.matchingRefs(ref, prefix)),
    compare: (ref, base, head) =>
      around(call('compare', ref), () => reader.compare(ref, base, head)),
    listBranches: (ref) =>
      around(call('listBranches', ref), () => reader.listBranches(ref)),
    listRepos: () => around(call('listRepos'), () => reader.listRepos()),
    getBudget: () => reader.getBudget(),
    readRateLimit: () =>
      around(call('readRateLimit'), () => reader.readRateLimit()),
    getTokenExpiration: () => reader.getTokenExpiration(),
  };
}

/** `reader` (one credential, one region) with every request through `around`. */
function wrapAmplifyReader(
  reader: AmplifyReader,
  source: { credentialId: string; region: string },
  around: Around,
): AmplifyReader {
  const call = (kind: string, appId?: string): RequestCall => ({
    provider: 'amplify',
    kind,
    ...source,
    ...(appId === undefined ? {} : { appId }),
  });
  return {
    listApps: () => around(call('listApps'), () => reader.listApps()),
    listBranches: (appId) =>
      around(call('listBranches', appId), () => reader.listBranches(appId)),
    listJobs: (appId, branch, max) =>
      around(call('listJobs', appId), () =>
        reader.listJobs(appId, branch, max),
      ),
    getJob: (appId, branch, jobId) =>
      around(call('getJob', appId), () => reader.getJob(appId, branch, jobId)),
  };
}

/** `providers` with every reader's requests passed through `around`.
 * Readers are wrapped once each, so a reader's identity stays stable for
 * the engine (one wrapped reader per credential, and per region). The
 * wrappers are held weakly: a factory may return a fresh reader on each
 * lookup (the demo's Amplify readers do), and a reader no longer used
 * shouldn't be kept alive by its wrapper. */
export function wrapProviders(
  providers: EngineProviders,
  around: Around,
): EngineProviders {
  const github = new WeakMap<GitHubReader, GitHubReader>();
  const amplify = new WeakMap<AmplifyReader, AmplifyReader>();
  return {
    github: (credentialId) => {
      const reader = providers.github(credentialId);
      if (!reader) return undefined;
      let wrapped = github.get(reader);
      if (!wrapped) {
        wrapped = wrapGitHubReader(reader, credentialId, around);
        github.set(reader, wrapped);
      }
      return wrapped;
    },
    amplify: (credentialId) => {
      const readerFor = providers.amplify(credentialId);
      if (!readerFor) return undefined;
      const wrappedFor: AmplifyReaderFor = (source) => {
        const reader = readerFor(source);
        let wrapped = amplify.get(reader);
        if (!wrapped) {
          wrapped = wrapAmplifyReader(reader, source, around);
          amplify.set(reader, wrapped);
        }
        return wrapped;
      };
      return wrappedFor;
    },
  };
}
