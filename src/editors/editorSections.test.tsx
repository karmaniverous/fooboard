/**
 * Tests for the editor sections the main editor tests don't reach:
 * Amplify rows from `ListApps` (apps without a GitHub repo can't be
 * added), repo-list failures, labelled column groups, drag reordering,
 * mapping rules and colours.
 *
 * @module
 */
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { DEFAULT_STATUS_COLORS } from '@/domain/config/colors';
import { type Dashboard, DashboardSchema } from '@/domain/config/dashboard';
import type { EngineProviders } from '@/engine';
import type { AmplifyReader } from '@/lib/amplify/reader';
import type { GitHubReader } from '@/lib/github/reader';
import { createAppStores } from '@/storage';
import { memoryStorage } from '@/storage/keyValue';
import { StoresContext } from '@/storage/storesContext';

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
    { id: 'dev', name: 'dev', branchPattern: 'dev' },
    { id: 'prod', name: 'prod', branchPattern: 'main' },
  ],
});

const amplify = {
  listApps: () =>
    Promise.resolve([
      { appId: 'a1', name: 'site', repository: 'https://github.com/acme/site' },
      { appId: 'a2', name: 'orphan', repository: 'https://gitlab.com/x/y' },
    ]),
} as unknown as AmplifyReader;

function setup(github: Partial<GitHubReader> = {}) {
  const providers: EngineProviders = {
    github: () => github as GitHubReader,
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
const tab = (name: string) => {
  fireEvent.click(screen.getByRole('button', { name }));
};

describe('editor sections', () => {
  it('adds an Amplify row from ListApps, refusing apps without a GitHub repo', async () => {
    const latest = setup();
    tab('Rows');
    fireEvent.click(screen.getByRole('button', { name: 'List Amplify apps' }));
    const orphan = await screen.findByRole('button', { name: /orphan/ });
    expect(orphan).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /site/ }));
    expect(latest.current.rows.at(-1)).toMatchObject({
      type: 'amplify',
      repo: 'acme/site',
      displayName: 'site',
      sources: [{ region: 'us-east-1', appId: 'a1' }],
    });
  });

  it('reports a repo list that fails to load', async () => {
    setup({ listRepos: () => Promise.reject(new Error('Bad credentials')) });
    tab('Rows');
    fireEvent.click(screen.getByRole('button', { name: 'Add a GitHub row' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Bad credentials',
    );
  });

  it('creates a labelled column group from a stage', () => {
    const latest = setup();
    tab('Stages');
    fireEvent.change(screen.getByLabelText('Group of prod'), {
      target: { value: 'new' },
    });
    const label = screen.getByLabelText('Label of the group of prod');
    fireEvent.change(label, { target: { value: 'Production' } });
    fireEvent.blur(label);
    expect(latest.current.columnGroups).toEqual([
      { id: 'group-prod', label: 'Production', memberIds: ['prod'] },
    ]);
  });

  it('reorders by dragging an item onto another', () => {
    const latest = setup();
    tab('Stages');
    const items = screen.getAllByRole('listitem');
    const grip = items[0]?.querySelector('[draggable]');
    if (!grip || !items[1]) throw new Error('drag handles not found');
    fireEvent.dragStart(grip, { dataTransfer: { effectAllowed: '' } });
    fireEvent.dragOver(items[1]);
    fireEvent.drop(items[1]);
    expect(latest.current.stages.map((s) => s.id)).toEqual(['prod', 'dev']);
  });

  it('edits mapping rules and colours', () => {
    const latest = setup();
    tab('Mapping');
    fireEvent.change(screen.getByLabelText('New Deploy phase tests value'), {
      target: { value: 'deploy' },
    });
    const deploy = screen.getByRole('group', { name: 'Deploy phase tests' });
    fireEvent.click(within(deploy).getByRole('button', { name: 'Add' }));
    expect(latest.current.mapping.phases.deploy.at(-1)).toEqual({
      field: 'jobName',
      operator: 'contains',
      value: 'deploy',
    });

    tab('Colours');
    fireEvent.change(screen.getByLabelText('Failure colour'), {
      target: { value: '#123456' },
    });
    expect(latest.current.statusColors.failure).toBe('#123456');
    fireEvent.click(screen.getByRole('button', { name: 'Reset colours' }));
    expect(latest.current.statusColors).toEqual(DEFAULT_STATUS_COLORS);
  });
});

describe('editor review fixes', () => {
  it('asks before deleting a match test, and Keep preserves it', () => {
    const latest = setup();
    tab('Mapping');
    fireEvent.change(screen.getByLabelText('New Deploy phase tests value'), {
      target: { value: 'deploy' },
    });
    const deploy = screen.getByRole('group', { name: 'Deploy phase tests' });
    fireEvent.click(within(deploy).getByRole('button', { name: 'Add' }));
    const count = latest.current.mapping.phases.deploy.length;
    const del = within(deploy).getByRole('button', {
      name: `Delete Deploy phase tests ${String(count)}`,
    });
    fireEvent.click(del);
    expect(latest.current.mapping.phases.deploy).toHaveLength(count);
    fireEvent.click(within(deploy).getByRole('button', { name: 'Keep' }));
    expect(latest.current.mapping.phases.deploy).toHaveLength(count);
    fireEvent.click(
      within(deploy).getByRole('button', {
        name: `Delete Deploy phase tests ${String(count)}`,
      }),
    );
    fireEvent.click(
      within(deploy).getByRole('button', { name: 'Delete deploy' }),
    );
    expect(latest.current.mapping.phases.deploy).toHaveLength(count - 1);
  });

  it('retries a failed repo list', async () => {
    let calls = 0;
    setup({
      listRepos: () =>
        ++calls === 1
          ? Promise.reject(new Error('Bad gateway'))
          : Promise.resolve([
              {
                full_name: 'acme/api',
                name: 'api',
                private: false,
                html_url: '',
                owner: { login: 'acme' },
              },
            ]),
    });
    tab('Rows');
    fireEvent.click(screen.getByRole('button', { name: 'Add a GitHub row' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Bad gateway');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(
      await screen.findByRole('button', { name: 'acme/api' }),
    ).toBeInTheDocument();
  });

  it('adds the same repo twice as independent rows', async () => {
    const latest = setup({
      listRepos: () =>
        Promise.resolve([
          {
            full_name: 'acme/api',
            name: 'api',
            private: false,
            html_url: '',
            owner: { login: 'acme' },
          },
        ]),
    });
    tab('Rows');
    fireEvent.click(screen.getByRole('button', { name: 'Add a GitHub row' }));
    fireEvent.click(await screen.findByRole('button', { name: 'acme/api' }));
    const rows = latest.current.rows.filter((r) => r.repo === 'acme/api');
    expect(rows.map((r) => r.id)).toEqual(['api', 'api-2']);

    fireEvent.change(
      screen.getAllByLabelText('New Row key tests for api value')[0],
      {
        target: { value: 'deploy-a' },
      },
    );
    const groups = screen.getAllByRole('group', {
      name: 'Row key tests for api',
    });
    fireEvent.click(within(groups[0]).getByRole('button', { name: 'Add' }));
    const tests = latest.current.rows
      .filter((r) => r.repo === 'acme/api')
      .map((r) => (r.type === 'github' ? r.rowKeyTests.length : -1));
    expect(tests).toEqual([1, 0]);
  });

  it('hides listed apps when the region changes, before or after the response', async () => {
    const latest = setup();
    tab('Rows');
    const region = screen.getByLabelText('Region');
    // Changed while the request is pending.
    fireEvent.click(screen.getByRole('button', { name: 'List Amplify apps' }));
    fireEvent.change(region, { target: { value: 'eu-west-1' } });
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.queryByRole('button', { name: /site/ })).toBeNull();

    // Listed for eu-west-1, then changed after the response.
    fireEvent.click(screen.getByRole('button', { name: 'List Amplify apps' }));
    expect(
      await screen.findByRole('button', { name: /site/ }),
    ).toBeInTheDocument();
    fireEvent.change(region, { target: { value: 'us-west-2' } });
    expect(screen.queryByRole('button', { name: /site/ })).toBeNull();

    fireEvent.change(region, { target: { value: 'eu-west-1' } });
    fireEvent.click(screen.getByRole('button', { name: /site/ }));
    expect(latest.current.rows.at(-1)).toMatchObject({
      sources: [{ region: 'eu-west-1', appId: 'a1' }],
    });
  });

  it('asks before deleting an Amplify source', async () => {
    const latest = setup();
    tab('Rows');
    fireEvent.click(screen.getByRole('button', { name: 'List Amplify apps' }));
    fireEvent.click(await screen.findByRole('button', { name: /site/ }));
    fireEvent.change(screen.getByLabelText('Region for a new site source'), {
      target: { value: 'eu-west-1' },
    });
    fireEvent.change(screen.getByLabelText('App ID for a new site source'), {
      target: { value: 'a9' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add source' }));
    const sources = () => {
      const row = latest.current.rows.at(-1);
      return row?.type === 'amplify' ? row.sources.length : 0;
    };
    expect(sources()).toBe(2);
    fireEvent.click(
      screen.getAllByRole('button', {
        name: 'Delete source',
      })[0],
    );
    expect(sources()).toBe(2);
    fireEvent.click(screen.getByRole('button', { name: 'Delete source a1' }));
    expect(sources()).toBe(1);
  });
});
