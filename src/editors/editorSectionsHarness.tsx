/**
 * The editor-section tests' harness: a starting dashboard, a query
 * environment over a fake Amplify reader per region (listing `site` in
 * us-east-1 and `orphan`, with no GitHub repo, in eu-west-1, unless a test
 * gives its own listing) and the GitHub port a test gives, and the editor
 * rendered with the latest draft exposed.
 *
 * @module
 */
import type { App } from '@aws-sdk/client-amplify';
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';

import { type Dashboard, DashboardSchema } from '@/domain/config/dashboard';
import { branchRules } from '@/domain/config/placement';
import { amplifyApp } from '@/lib/amplify/sdkShapes';
import type { GitHubApi } from '@/lib/github';
import { QueryProvider } from '@/query/QueryProvider';
import { createAppStores } from '@/storage';
import { memoryStorage } from '@/storage/keyValue';
import { StoresContext } from '@/storage/storesContext';
import { fakeAmplifyReader, fakeGitHubApi } from '@/test/fakeReaders';
import { testQueryEnv } from '@/test/queryEnv';

import { DashboardEditor } from './DashboardEditor';

export const start = DashboardSchema.parse({
  id: 'd',
  name: 'Board',
  credentials: [
    { id: 'gh', kind: 'github', label: 'gh' },
    { id: 'aws', kind: 'aws', label: 'aws' },
  ],
  settings: { githubToken: 'gh', awsKey: 'aws' },
  rows: [
    { type: 'github', id: 'api', repo: 'acme/api', displayName: 'api' },
    { type: 'github', id: 'web', repo: 'acme/web', displayName: 'web' },
  ],
  stages: [
    { id: 'dev', name: 'dev', rules: branchRules('dev') },
    { id: 'prod', name: 'prod', rules: branchRules('main') },
  ],
});

const twoApps: Partial<Record<string, App[]>> = {
  'us-east-1': [
    amplifyApp({
      appId: 'a1',
      name: 'site',
      repository: 'https://github.com/acme/site',
    }),
  ],
  'eu-west-1': [
    amplifyApp({
      appId: 'a2',
      name: 'orphan',
      repository: 'https://gitlab.com/x/y',
    }),
  ],
};

/** The apps the fake reader lists in `region`. */
export type ListAppsIn = (region: string) => Promise<App[]>;

export function setup(
  github: Partial<GitHubApi> = {},
  listAppsIn: ListAppsIn = (region) => Promise.resolve(twoApps[region] ?? []),
  first: Dashboard = start,
): { current: Dashboard } {
  const env = testQueryEnv({
    github: () => fakeGitHubApi(github),
    amplifyIn: (region) =>
      fakeAmplifyReader({ listApps: () => listAppsIn(region) }),
  });
  const latest = { current: first };
  function Harness(): React.JSX.Element {
    const [d, setD] = useState<Dashboard>(first);
    return (
      <DashboardEditor
        dashboard={d}
        onChange={(next) => {
          latest.current = next;
          setD(next);
        }}
      />
    );
  }
  render(
    <StoresContext value={createAppStores(memoryStorage())}>
      <MemoryRouter>
        <QueryProvider env={env}>
          <Harness />
        </QueryProvider>
      </MemoryRouter>
    </StoresContext>,
  );
  return latest;
}
export const tab = (name: string): void => {
  fireEvent.mouseDown(screen.getByRole('tab', { name }), { button: 0 });
};
