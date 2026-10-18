/**
 * Tests for group and override editing in the editor (spec.md C-14b,
 * C-14c, C-1a, C-15, C-21): starting a group from a row, the group's
 * credentials and overrides, inherited patterns and credentials shown on
 * members, branches found and suggested, dragging across a group edge, and
 * *Add override* from an unmapped run.
 *
 * @module
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { type Dashboard, DashboardSchema } from '@/domain/config/dashboard';
import type { EngineProviders } from '@/engine';
import type { GitHubReader } from '@/lib/github/reader';
import { createAppStores } from '@/storage';
import { memoryStorage } from '@/storage/keyValue';
import { StoresContext } from '@/storage/storesContext';

import { DashboardEditor } from './DashboardEditor';
import type { EditorDraft } from './draft';

const start = DashboardSchema.parse({
  id: 'd',
  name: 'Board',
  credentials: [
    { id: 'org', kind: 'github', label: 'org' },
    { id: 'team', kind: 'github', label: 'team' },
  ],
  defaultCredentials: { github: 'org' },
  rows: [
    { type: 'github', id: 'api', repo: 'acme/api', displayName: 'api' },
    { type: 'github', id: 'web', repo: 'acme/web', displayName: 'web' },
  ],
  stages: [
    { id: 'dev', name: 'dev', branchPattern: 'dev' },
    { id: 'prod', name: 'prod', branchPattern: 'main' },
  ],
});

const reader = {
  listBranches: () => Promise.resolve([{ name: 'main' }, { name: 'rc/1' }]),
} as unknown as GitHubReader;
const providers: EngineProviders = {
  github: () => reader,
  amplify: () => undefined,
};

function setup(initial: Dashboard = start, draft?: EditorDraft) {
  const latest = { current: initial };
  function Harness(): React.JSX.Element {
    const [d, setD] = useState<Dashboard>(initial);
    return (
      <DashboardEditor
        dashboard={d}
        providers={providers}
        draft={draft}
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
  fireEvent.click(screen.getByRole('button', { name: 'Rows' }));
  return latest;
}

const commit = (label: string, value: string) => {
  const field = screen.getByLabelText(label);
  fireEvent.change(field, { target: { value } });
  fireEvent.blur(field);
};

describe('row groups in the editor', () => {
  it("starts a group from a row; members show the group's settings as inherited", () => {
    const latest = setup();
    fireEvent.change(screen.getByLabelText('Group of api'), {
      target: { value: 'new' },
    });
    fireEvent.change(screen.getByLabelText('GitHub token for this group'), {
      target: { value: 'team' },
    });
    commit('prod branch override for this group', 'release/*');
    expect(latest.current.rowGroups).toEqual([
      {
        id: 'group-api',
        memberIds: ['api'],
        branchPatternOverrides: { prod: 'release/*' },
        defaultCredentials: { github: 'team' },
      },
    ]);
    const token = screen.getByLabelText('GitHub token for api');
    expect(within(token).getAllByRole('option')[0]).toHaveTextContent(
      "team (the group's default)",
    );
    expect(
      screen.getByLabelText('prod branch override for api'),
    ).toHaveAttribute('placeholder', 'release/* (inherited)');
    expect(
      screen.getByText(/Moving this row out deletes its group/),
    ).toBeInTheDocument();

    commit('prod branch override for api', 'rc/*');
    expect(latest.current.rows[0]?.branchPatternOverrides).toEqual({
      prod: 'rc/*',
    });
    commit('prod branch override for api', '');
    expect(latest.current.rows[0]?.branchPatternOverrides).toEqual({});

    fireEvent.click(screen.getByRole('button', { name: 'Delete group' }));
    fireEvent.click(screen.getByRole('button', { name: /^Delete the group/ }));
    expect(latest.current.rowGroups).toEqual([]);
    expect(latest.current.rows.map((r) => r.id)).toEqual(['api', 'web']);
  });

  it("finds a row's branches and offers them in its fields, not as a list", async () => {
    setup();
    fireEvent.click(
      screen.getAllByRole('button', {
        name: 'Find branches',
      })[0],
    );
    expect(await screen.findByRole('status')).toHaveTextContent(
      '2 branches found',
    );
    expect(screen.queryByRole('list', { name: 'Branches found' })).toBeNull();
    const options = [...document.querySelectorAll('datalist option')];
    expect(options.map((o) => o.getAttribute('value'))).toEqual([
      'main',
      'rc/1',
    ]);
    expect(
      screen.getByLabelText('dev branch override for api'),
    ).toHaveAttribute('list');
  });

  it('drags a row across a group edge into the group, and steps it back out', () => {
    const latest = setup(
      DashboardSchema.parse({
        ...start,
        rowGroups: [{ id: 'g', memberIds: ['api'] }],
      }),
    );
    const items = screen
      .getAllByRole('listitem')
      .filter((li) => li.querySelector(':scope > div > [draggable]'));
    const api = items.at(0);
    const web = items.at(1);
    const grip = web?.querySelector('[draggable]');
    if (!grip || !api) throw new Error('drag handles not found');
    fireEvent.dragStart(grip, { dataTransfer: { effectAllowed: '' } });
    fireEvent.dragOver(api);
    fireEvent.drop(api);
    expect(latest.current.rows.map((r) => r.id)).toEqual(['web', 'api']);
    expect(latest.current.rowGroups[0]?.memberIds).toEqual(['web', 'api']);

    expect(screen.getByRole('button', { name: 'Move web up' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Move api down' }));
    expect(latest.current.rowGroups[0]?.memberIds).toEqual(['web']);
    expect(
      screen.getByRole('button', { name: 'Move api down' }),
    ).toBeDisabled();
  });

  it("applies Add override to the row's group", () => {
    const grouped = DashboardSchema.parse({
      ...start,
      rowGroups: [{ id: 'g', label: 'Frontend', memberIds: ['api'] }],
    });
    const latest = setup(grouped, {
      tab: 'Rows',
      rowId: 'api',
      overrideBranch: 'preview/release',
    });
    const fix = screen.getByRole('group', {
      name: 'Override for preview/release',
    });
    fireEvent.change(within(fix).getByLabelText('Stage to override'), {
      target: { value: 'prod' },
    });
    fireEvent.change(within(fix).getByLabelText('Override scope'), {
      target: { value: 'group:g' },
    });
    fireEvent.click(within(fix).getByRole('button', { name: 'Apply' }));
    expect(latest.current.rowGroups[0]?.branchPatternOverrides).toEqual({
      prod: 'preview/release',
    });
    expect(latest.current.rows[0]?.branchPatternOverrides).toEqual({});
  });

  it("offers every GitHub row reading the run's repo as the override target", () => {
    const twoRows = DashboardSchema.parse({
      ...start,
      rows: [
        { type: 'github', id: 'api', repo: 'acme/api', displayName: 'api' },
        {
          type: 'github',
          id: 'api-jobs',
          repo: 'acme/api',
          displayName: 'api-jobs',
        },
        { type: 'github', id: 'web', repo: 'acme/web', displayName: 'web' },
      ],
    });
    const latest = setup(twoRows, {
      tab: 'Rows',
      rowId: 'api',
      overrideBranch: 'hotfix/1',
    });
    const fix = screen.getByRole('group', { name: 'Override for hotfix/1' });
    const target = within(fix).getByLabelText('Override scope');
    expect(
      within(target)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['row api', 'row api-jobs']);
    fireEvent.change(target, { target: { value: 'row:api-jobs' } });
    fireEvent.click(within(fix).getByRole('button', { name: 'Apply' }));
    expect(latest.current.rows[1]?.branchPatternOverrides).toEqual({
      dev: 'hotfix/1',
    });
    expect(latest.current.rows[0]?.branchPatternOverrides).toEqual({});
  });
});
