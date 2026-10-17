/**
 * Tests for the dashboard editor: renaming, adding a row from the repo
 * picker (display name without the owner), keyboard reordering, confirmed
 * removal, adding a stage from discovered branches with a match preview,
 * source choices that exclude cycles, and creating a dashboard from home.
 *
 * @module
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { type Dashboard, DashboardSchema } from '@/domain/config/dashboard';
import type { EngineProviders } from '@/engine';
import type { GitHubReader } from '@/lib/github/reader';
import { Home } from '@/pages/Home';
import { createAppStores } from '@/storage';
import { memoryStorage } from '@/storage/keyValue';
import { StoresContext } from '@/storage/storesContext';

import { DashboardEditor } from './DashboardEditor';

const branches: Record<string, string[]> = {
  api: ['main', 'release/24.3', 'release/24.2'],
  web: ['main', 'release/24.3'],
};
const reader = {
  listRepos: () =>
    Promise.resolve(
      ['acme/api', 'acme/web', 'acme/docs'].map((full_name) => ({
        full_name,
        name: full_name.split('/')[1] ?? '',
        private: false,
        html_url: '',
        owner: { login: 'acme' },
      })),
    ),
  listBranches: ({ repo }: { repo: string }) =>
    Promise.resolve(
      (branches[repo] ?? []).map((name) => ({ name, commit: { sha: 'x' } })),
    ),
} as unknown as GitHubReader;
const providers: EngineProviders = {
  github: () => reader,
  amplify: () => undefined,
};

const start = DashboardSchema.parse({
  id: 'd',
  name: 'Board',
  credentials: [{ id: 'gh', kind: 'github', label: 'gh' }],
  defaultCredentials: { github: 'gh' },
  rows: [
    { type: 'github', id: 'api', repo: 'acme/api', displayName: 'api' },
    { type: 'github', id: 'web', repo: 'acme/web', displayName: 'web' },
  ],
  stages: [
    { id: 'dev', name: 'dev', branchPattern: 'dev' },
    { id: 'prod', name: 'prod', branchPattern: 'main', sourceStageId: 'dev' },
  ],
});

function setup() {
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
      branchPattern: 'release/**',
    });
  });

  it('offers only source stages that keep the chain acyclic', () => {
    setup();
    tab('Stages');
    const source = screen.getByLabelText('Source stage of dev');
    const options = within(source)
      .getAllByRole('option')
      .map((o) => o.textContent);
    expect(options).toEqual(['No source stage']); // prod already sources from dev
  });
});

describe('Create a dashboard', () => {
  it('saves a dashboard from a preset and opens it', () => {
    const stores = createAppStores(memoryStorage());
    render(
      <StoresContext value={stores}>
        <MemoryRouter>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/d/:id" element={<p>opened</p>} />
          </Routes>
        </MemoryRouter>
      </StoresContext>,
    );
    fireEvent.change(screen.getByLabelText('Dashboard name'), {
      target: { value: 'Acme' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create a dashboard' }));
    expect(screen.getByText('opened')).toBeInTheDocument();
    const loaded = stores.config.load();
    expect(
      loaded.kind === 'ok' &&
        loaded.root.dashboards[0]?.stages.map((s) => s.name),
    ).toEqual(['dev', 'staging', 'prod']);
  });
});
