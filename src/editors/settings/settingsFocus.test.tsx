/**
 * Tests for the settings editor in the dashboard editor (spec.md §3.11):
 * a setting's problem opens the editor at its field (the place's item,
 * its *Settings* and the entry, marked), at a row, a cell and a column;
 * and every level of the editor holds a settings editor (the stage and
 * column group on the Stages tab included).
 *
 * @module
 */
import { fireEvent, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { type Dashboard, DashboardSchema } from '@/domain/config/dashboard';
import type { EditTarget } from '@/domain/problems/problem';
import { createAppStores } from '@/storage';
import { memoryStorage } from '@/storage/keyValue';
import { StoresContext } from '@/storage/storesContext';
import { envRender } from '@/test/envRender';

import { DashboardEditor } from '../DashboardEditor';
import { focusKeys, settingKey, tabFor } from '../editTarget';

const start = DashboardSchema.parse({
  id: 'd',
  name: 'Board',
  credentials: [{ id: 'k1', kind: 'aws', label: 'k1' }],
  rows: [
    {
      type: 'amplify',
      id: 'site',
      repo: 'acme/site',
      displayName: 'site',
      pinnedApps: [{ region: 'us-east-1', appId: 'a1' }],
    },
  ],
  stages: [
    { id: 'dev', name: 'Dev' },
    { id: 'prod', name: 'Prod' },
  ],
  columnGroups: [{ id: 'cg', label: 'Live', memberIds: ['prod'] }],
  rowGroups: [{ id: 'rg', label: 'Web', memberIds: ['site'] }],
});

function setup(target?: EditTarget, first: Dashboard = start) {
  function Harness(): React.JSX.Element {
    const [d, setD] = useState<Dashboard>(first);
    return (
      <DashboardEditor
        dashboard={d}
        draft={
          target ? { tab: tabFor(target), focus: focusKeys(target) } : undefined
        }
        onChange={setD}
      />
    );
  }
  envRender()(
    <StoresContext value={createAppStores(memoryStorage())}>
      <MemoryRouter>
        <Harness />
      </MemoryRouter>
    </StoresContext>,
  );
}

/** The entry for `target`, which must be on screen and marked. */
function focusedEntry(target: EditTarget & { kind: 'settings' }) {
  const key = settingKey(target.place, target.field, target.source);
  const entry = document.querySelector(`[data-edit-target="${key}"]`);
  if (!(entry instanceof HTMLElement)) throw new Error(`no entry ${key}`);
  return entry;
}

describe('a setting opened from its problem', () => {
  it.each<[string, EditTarget & { kind: 'settings' }, string]>([
    [
      'a row group',
      {
        kind: 'settings',
        place: { level: 'rowGroup', groupId: 'rg' },
        field: 'awsKey',
      },
      'AWS key for Row group Web',
    ],
    [
      'a column group',
      {
        kind: 'settings',
        place: { level: 'columnGroup', groupId: 'cg' },
        field: 'awsKey',
      },
      'AWS key for Column group Live',
    ],
    [
      'a row',
      {
        kind: 'settings',
        place: { level: 'row', rowId: 'site' },
        field: 'awsKey',
      },
      'AWS key for Row site',
    ],
    [
      'a cell',
      {
        kind: 'settings',
        place: { level: 'cell', rowId: 'site', stageId: 'prod' },
        field: 'awsKey',
      },
      'AWS key for Cell site × Prod',
    ],
    [
      'a column',
      {
        kind: 'settings',
        place: { level: 'column', stageId: 'dev' },
        field: 'awsKey',
      },
      'AWS key for Column Dev',
    ],
    [
      'the dashboard',
      {
        kind: 'settings',
        place: { level: 'dashboard' },
        field: 'statusSets',
        source: 'amplify',
      },
      'Amplify status set for Dashboard Board',
    ],
  ])('opens %s at its field', (_label, target, control) => {
    setup(target);
    const entry = focusedEntry(target);
    expect(
      within(entry).getByRole('combobox', { name: control }),
    ).toBeVisible();
  });
});

describe('settings at every level of the editor', () => {
  it('holds a settings editor on each stage and column group', () => {
    setup();
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Stages' }), {
      button: 0,
    });
    fireEvent.click(screen.getByRole('button', { name: /^Live/ }));
    fireEvent.click(screen.getAllByRole('button', { name: /^Settings/ })[0]);
    expect(
      screen.getByRole('combobox', { name: 'AWS key for Column group Live' }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: /^Dev/ }));
    fireEvent.click(screen.getAllByRole('button', { name: /^Settings/ })[0]);
    expect(
      screen.getByRole('combobox', { name: 'AWS key for Column Dev' }),
    ).toBeVisible();
  });
});
