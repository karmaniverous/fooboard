/**
 * The editor-section tests' harness: a starting dashboard, a fake Amplify
 * reader, and the editor rendered with the latest draft exposed.
 *
 * @module
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';

import { type Dashboard, DashboardSchema } from '@/domain/config/dashboard';
import { branchRules } from '@/domain/config/placement';
import type { EngineProviders } from '@/engine';
import { amplifyApp } from '@/lib/amplify/sdkShapes';
import type { GitHubReader } from '@/lib/github/reader';
import { createAppStores } from '@/storage';
import { memoryStorage } from '@/storage/keyValue';
import { StoresContext } from '@/storage/storesContext';
import { fakeAmplifyReader, fakeGitHubReader } from '@/test/fakeReaders';

import { DashboardEditor } from './DashboardEditor';

const start = DashboardSchema.parse({
  id: 'd',
  name: 'Board',
  credentials: [
    { id: 'gh', kind: 'github', label: 'gh' },
    { id: 'aws', kind: 'aws', label: 'aws' },
  ],
  defaultCredentials: { github: 'gh', aws: 'aws' },
  rows: [
    { type: 'github', id: 'api', repo: 'acme/api', displayName: 'api' },
    { type: 'github', id: 'web', repo: 'acme/web', displayName: 'web' },
  ],
  stages: [
    { id: 'dev', name: 'dev', rules: branchRules('dev') },
    { id: 'prod', name: 'prod', rules: branchRules('main') },
  ],
});

const amplify = fakeAmplifyReader({
  listApps: () =>
    Promise.resolve([
      amplifyApp({
        appId: 'a1',
        name: 'site',
        repository: 'https://github.com/acme/site',
      }),
      amplifyApp({
        appId: 'a2',
        name: 'orphan',
        repository: 'https://gitlab.com/x/y',
      }),
    ]),
});

export function setup(github: Partial<GitHubReader> = {}) {
  const providers: EngineProviders = {
    github: () => fakeGitHubReader(github),
    amplify: () => () => amplify,
  };
  const latest = { current: start };
  function Harness(): React.JSX.Element {
    const [d, setD] = useState<Dashboard>(start);
    return (
      <DashboardEditor
        dashboard={d}
        providers={providers}
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
        <Harness />
      </MemoryRouter>
    </StoresContext>,
  );
  return latest;
}
export const tab = (name: string) => {
  fireEvent.mouseDown(screen.getByRole('tab', { name }), { button: 0 });
};
