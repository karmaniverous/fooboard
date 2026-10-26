/**
 * Tests for the dashboard editor: renaming, adding a row from the repo
 * picker (display name without the owner), keyboard reordering, confirmed
 * removal, adding a stage from discovered branches with a match preview,
 * source choices that exclude cycles, and a field saved on changing tab.
 *
 * @module
 */
import { fireEvent, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { type Dashboard, DashboardSchema } from '@/domain/config/dashboard';
import { branchRules } from '@/domain/config/placement';
import { createAppStores } from '@/storage';
import { memoryStorage } from '@/storage/keyValue';
import { StoresContext } from '@/storage/storesContext';
import { optionsOf } from '@/test/choose';
import { envRender } from '@/test/envRender';
import { fakeGitHubApi, fetched, ghBranch, ghRepo } from '@/test/fakeReaders';
import { focusElement } from '@/test/focus';
import { expand } from '@/test/openItem';

import { DashboardEditor } from './DashboardEditor';

const branches: Record<string, string[]> = {
  api: ['main', 'release/24.3', 'release/24.2'],
  web: ['main', 'release/24.3'],
};
const reader = fakeGitHubApi({
  reposPage: () =>
    Promise.resolve(
      fetched(
        ['acme/api', 'acme/web', 'acme/docs'].map((fullName) =>
          ghRepo(fullName),
        ),
      ),
    ),
  branchesPage: ({ repo }) =>
    Promise.resolve(
      fetched((branches[repo] ?? []).map((name) => ghBranch(name, 'x'))),
    ),
});
const render = envRender({
  github: () => reader,
  amplify: () => undefined,
});

const start = DashboardSchema.parse({
  id: 'd',
  name: 'Board',
  credentials: [{ id: 'gh', kind: 'github', label: 'gh' }],
  settings: { githubToken: 'gh' },
  rows: [
    { type: 'github', id: 'api', repo: 'acme/api', displayName: 'api' },
    { type: 'github', id: 'web', repo: 'acme/web', displayName: 'web' },
  ],
  stages: [
    { id: 'dev', name: 'dev', rules: branchRules('dev') },
    {
      id: 'prod',
      name: 'prod',
      rules: branchRules('main'),
      sourceStageId: 'dev',
    },
  ],
});

function setup() {
  const latest = { current: start };
  function Harness(): React.JSX.Element {
    const [d, setD] = useState<Dashboard>(start);
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
        <Harness />
      </MemoryRouter>
    </StoresContext>,
  );
  return latest;
}

const tab = (name: string) => {
  fireEvent.mouseDown(screen.getByRole('tab', { name }), { button: 0 });
};

describe('DashboardEditor', () => {
  it('renames the dashboard', () => {
    const latest = setup();
    const input = screen.getByLabelText('Dashboard name');
    fireEvent.change(input, { target: { value: 'Platform' } });
    fireEvent.blur(input);
    expect(latest.current.name).toBe('Platform');
  });

  it('adds a row from the repo picker, reorders and removes rows', async () => {
    const latest = setup();
    tab('Rows');
    fireEvent.click(screen.getByRole('button', { name: 'Add a GitHub row' }));
    fireEvent.change(await screen.findByLabelText('Search repos'), {
      target: { value: 'doc' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'acme/docs' }));
    expect(latest.current.rows.at(-1)).toMatchObject({
      repo: 'acme/docs',
      displayName: 'docs',
    });

    fireEvent.click(screen.getByRole('button', { name: 'Move api down' }));
    expect(latest.current.rows.map((r) => r.id)).toEqual([
      'web',
      'api',
      'docs',
    ]);

    const item = screen
      .getByRole('button', { name: 'Move docs up' })
      .closest('li');
    if (!item) throw new Error('row item not found');
    fireEvent.click(within(item).getByRole('button', { name: 'Remove' }));
    expect(latest.current.rows).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: 'Remove docs' }));
    expect(latest.current.rows).toHaveLength(2);
  });

  it('adds a stage from discovered branches, previewing the match', async () => {
    const latest = setup();
    tab('Stages');
    fireEvent.click(
      screen.getByRole('button', { name: 'Find branches in your repos' }),
    );
    fireEvent.click(
      await screen.findByRole('button', { name: /release\/24\.3 2\/2/ }),
    );
    fireEvent.change(screen.getByLabelText('New stage branch or pattern'), {
      target: { value: 'release/**' },
    });
    expect(
      screen.getByText(/Matches 2\/2 repos: release\/24\.2, release\/24\.3/),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('New stage name'), {
      target: { value: 'Release' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add stage' }));
    expect(latest.current.stages.at(-1)).toEqual({
      id: 'release',
      name: 'Release',
      rules: branchRules('release/**'),
      settings: {},
    });
  });

  it('offers only source stages that keep the chain acyclic', () => {
    setup();
    tab('Stages');
    expand('dev');
    const source = screen.getByLabelText('Source stage of dev');
    expect(optionsOf(source)).toEqual(['No source stage']); // prod already sources from dev
  });
});

describe('DashboardEditor tabs', () => {
  it('saves a field being edited when another tab is chosen', () => {
    const latest = setup();
    const input = screen.getByLabelText('Dashboard name');
    focusElement(input);
    fireEvent.change(input, { target: { value: 'Platform' } });
    tab('Rows');
    expect(latest.current.name).toBe('Platform');
    expect(screen.getByRole('tab', { name: 'Rows' })).toHaveFocus();
  });
});
