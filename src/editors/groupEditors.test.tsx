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
import { branchRules } from '@/domain/config/placement';
import { branchRule } from '@/domain/rules/branch';
import type { EngineProviders } from '@/engine';
import { createAppStores } from '@/storage';
import { memoryStorage } from '@/storage/keyValue';
import { StoresContext } from '@/storage/storesContext';
import { choose, optionsOf } from '@/test/choose';
import { fakeGitHubReader, ghBranch } from '@/test/fakeReaders';
import { keyboardDrag } from '@/test/keyboardDrag';
import { expand } from '@/test/openItem';

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
    { id: 'dev', name: 'dev', rules: branchRules('dev') },
    { id: 'prod', name: 'prod', rules: branchRules('main') },
  ],
});

const reader = fakeGitHubReader({
  listBranches: () => Promise.resolve([ghBranch('main'), ghBranch('rc/1')]),
});
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
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'Rows' }), {
    button: 0,
  });
  return latest;
}

/** Open every closed *Stage overrides* section. */
const openOverrides = () => {
  for (const t of screen.queryAllByRole('button', {
    name: /^Stage overrides/,
  }))
    if (t.getAttribute('aria-expanded') !== 'true') fireEvent.click(t);
};

const commit = (label: string, value: string) => {
  openOverrides();
  const field = screen.getByLabelText(label);
  fireEvent.change(field, { target: { value } });
  fireEvent.blur(field);
};

describe('row groups in the editor', () => {
  it("starts a group from a row; members show the group's settings as inherited", () => {
    const latest = setup();
    expand('api');
    choose(screen.getByLabelText('Group of api'), 'New group from api');
    fireEvent.click(screen.getByRole('button', { name: /^Group settings/ }));
    choose(screen.getByLabelText('GitHub token for this group'), 'team');
    commit('prod branch override for this group', 'release/*');
    expect(latest.current.rowGroups).toEqual([
      {
        id: 'group-api',
        memberIds: ['api'],
        stageRules: { prod: branchRules('release/*') },
        rowRules: {},
        defaultCredentials: { github: 'team' },
        statusSets: {},
      },
    ]);
    const token = screen.getByLabelText('GitHub token for api');
    expect(optionsOf(token)[0]).toBe("team (the group's default)");
    openOverrides();
    expect(
      screen.getByLabelText('prod branch override for api'),
    ).toHaveAttribute('placeholder', 'release/* (inherited)');
    expect(
      screen.getByText(/Moving this row out deletes its group/),
    ).toBeInTheDocument();

    commit('prod branch override for api', 'rc/*');
    expect(latest.current.rows[0]?.stageRules).toEqual({
      prod: branchRule('rc/*'),
    });
    commit('prod branch override for api', '');
    expect(latest.current.rows[0]?.stageRules).toEqual({});

    fireEvent.click(screen.getByRole('button', { name: 'Delete group' }));
    fireEvent.click(screen.getByRole('button', { name: /^Delete the group/ }));
    expect(latest.current.rowGroups).toEqual([]);
    expect(latest.current.rows.map((r) => r.id)).toEqual(['api', 'web']);
  });

  it("finds a row's branches and offers them in its fields, not as a list", async () => {
    setup();
    expand('api');
    openOverrides();
    fireEvent.click(
      screen.getAllByRole('button', {
        name: 'Find branches',
      })[0],
    );
    // (By text: the drag-and-drop announcer is a status region too.)
    expect(await screen.findByText(/^2 branches found/)).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Branches found' })).toBeNull();
    const options = [...document.querySelectorAll('datalist option')];
    expect(options.map((o) => o.getAttribute('value'))).toEqual([
      'main',
      'rc/1',
    ]);
    openOverrides();
    expect(
      screen.getByLabelText('dev branch override for api'),
    ).toHaveAttribute('list');
  });

  it('drags a row across a group edge into the group, and steps it back out', async () => {
    const latest = setup(
      DashboardSchema.parse({
        ...start,
        rowGroups: [{ id: 'g', memberIds: ['api'] }],
      }),
    );
    await keyboardDrag(
      screen.getByRole('button', { name: 'Drag web to reorder' }),
      -1,
    );
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
      focus: ['row:api:override', 'row:api'],
      override: { branch: 'preview/release', rowIds: ['api'] },
    });
    const fix = screen.getByRole('group', {
      name: 'Override for preview/release',
    });
    choose(within(fix).getByLabelText('Stage to override'), 'prod');
    choose(within(fix).getByLabelText('Override scope'), 'group Frontend');
    fireEvent.click(within(fix).getByRole('button', { name: 'Apply' }));
    expect(latest.current.rowGroups[0]?.stageRules).toEqual({
      prod: branchRules('preview/release'),
    });
    expect(latest.current.rows[0]?.stageRules).toEqual({});
  });

  it('offers every row reading the record as the override target', () => {
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
      focus: ['row:api:override', 'row:api'],
      override: { branch: 'hotfix/1', rowIds: ['api', 'api-jobs'] },
    });
    const fix = screen.getByRole('group', { name: 'Override for hotfix/1' });
    const target = within(fix).getByLabelText('Override scope');
    expect(optionsOf(target)).toEqual(['row api', 'row api-jobs']);
    choose(target, 'row api-jobs');
    fireEvent.click(within(fix).getByRole('button', { name: 'Apply' }));
    expect(latest.current.rows[1]?.stageRules).toEqual({
      dev: branchRule('hotfix/1'),
    });
    expect(latest.current.rows[0]?.stageRules).toEqual({});
  });

  it("keeps a row's overrides collapsed, counting them, until opened", () => {
    setup(
      DashboardSchema.parse({
        ...start,
        rows: [
          { ...start.rows[0], stageRules: { prod: branchRule('release/*') } },
          start.rows[1],
        ],
      }),
    );
    expand('api');
    const trigger = screen.getByRole('button', {
      name: 'Stage overrides (1)',
    });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByLabelText('prod branch override for api')).toBeNull();
    fireEvent.click(trigger);
    expect(screen.getByLabelText('prod branch override for api')).toHaveValue(
      'release/*',
    );
  });
});
