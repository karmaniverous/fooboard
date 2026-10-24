/**
 * Tests for a row's *Cell settings* and its pinned apps in the editor
 * (spec.md §3.11–3.12): the stages collapse one open at a time, each
 * holding its cell's settings; the disclosure counts what all the cells
 * set; a pin's AWS key is edited in place; and the cell detail sheet
 * lists what a cell reads with its origins.
 *
 * @module
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { cellNames, cellSettingsAt } from '@/board/cellNames';
import { type Dashboard, DashboardSchema } from '@/domain/config/dashboard';
import type { AmplifyRow } from '@/domain/config/row';
import { cellKey } from '@/engine/types';
import { choose } from '@/test/choose';

import { PinnedApps } from '../PinnedApps';
import { CellSettings } from './CellSettings';

const start = DashboardSchema.parse({
  id: 'd',
  name: 'Board',
  credentials: [
    { id: 'gh', kind: 'github', label: 'org' },
    { id: 'k1', kind: 'aws', label: 'k1' },
  ],
  settings: { githubToken: 'gh' },
  stages: [
    { id: 'dev', name: 'dev' },
    { id: 'prod', name: 'prod' },
  ],
  rows: [
    {
      type: 'amplify',
      id: 'site',
      repo: 'acme/site',
      displayName: 'site',
      pinnedApps: [{ region: 'us-east-1', appId: 'a1' }],
      cellSettings: { prod: { statusSets: { amplify: 'amplify' } } },
    },
  ],
});

function setup(first: Dashboard = start) {
  const latest = { current: first };
  function Harness(): React.JSX.Element {
    const [d, setD] = useState(first);
    const row = d.rows[0];
    if (row.type !== 'amplify') throw new Error('site is Amplify');
    const change = (next: Dashboard) => {
      latest.current = next;
      setD(next);
    };
    return (
      <>
        <CellSettings dashboard={d} row={row} onChange={change} />
        <PinnedApps
          dashboard={d}
          row={row}
          onChange={(r: AmplifyRow) => {
            change({ ...d, rows: [r] });
          }}
        />
      </>
    );
  }
  render(<Harness />);
  return latest;
}

describe('CellSettings', () => {
  it("counts every cell's fields and edits one cell at a time", () => {
    const latest = setup();
    const disclosure = screen.getByRole('button', { name: /^Cell settings/ });
    expect(disclosure).toHaveTextContent('Cell settings (1)');
    fireEvent.click(disclosure);
    fireEvent.click(screen.getByRole('button', { name: /^dev/ }));
    choose(
      screen.getByRole('combobox', { name: 'AWS key for Cell site × dev' }),
      'k1',
    );
    expect(latest.current.rows[0]?.cellSettings).toEqual({
      dev: { awsKey: 'k1' },
      prod: { statusSets: { amplify: 'amplify' } },
    });
    expect(disclosure).toHaveTextContent('Cell settings (2)');
    // Opening another cell closes this one.
    fireEvent.click(screen.getByRole('button', { name: /^prod/ }));
    expect(
      screen.queryByRole('combobox', { name: 'AWS key for Cell site × dev' }),
    ).toBeNull();
  });

  it('pins an app under a key, leaving the other pins as they are', () => {
    const latest = setup();
    choose(
      screen.getByRole('combobox', { name: 'AWS key for a new site pin' }),
      'k1',
    );
    fireEvent.change(screen.getByLabelText('Region for a new site pin'), {
      target: { value: 'eu-west-1' },
    });
    fireEvent.change(screen.getByLabelText('App ID for a new site pin'), {
      target: { value: 'a2' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Pin' }));
    choose(
      screen.getByRole('combobox', { name: 'AWS key for site pinned app a2' }),
      'No key (serves any cell no keyed pin does)',
    );
    const row = latest.current.rows[0];
    expect(row.type === 'amplify' && row.pinnedApps).toEqual([
      { region: 'us-east-1', appId: 'a1' },
      { region: 'eu-west-1', appId: 'a2' },
    ]);
  });

  it("keeps a pin's key control, and so its focus, as its key changes", () => {
    setup();
    const name = 'AWS key for site pinned app a1';
    const control = screen.getByRole('combobox', { name });
    choose(control, 'k1');
    expect(screen.getByRole('combobox', { name })).toBe(control);
  });

  it('offers no Pin for an app already pinned under that key', () => {
    setup();
    const fill = (label: string, value: string) => {
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    };
    fill('Region for a new site pin', 'us-east-1');
    fill('App ID for a new site pin', 'a1');
    expect(screen.getByRole('button', { name: 'Pin' })).toBeDisabled();
    // The same app id in another region is another app.
    fill('Region for a new site pin', 'eu-west-1');
    expect(screen.getByRole('button', { name: 'Pin' })).toBeEnabled();
    fill('Region for a new site pin', 'us-east-1');
    choose(
      screen.getByRole('combobox', { name: 'AWS key for a new site pin' }),
      'k1',
    );
    expect(screen.getByRole('button', { name: 'Pin' })).toBeEnabled();
  });

  it("edits a pin's AWS key in place", () => {
    const latest = setup();
    choose(
      screen.getByRole('combobox', { name: 'AWS key for site pinned app a1' }),
      'k1',
    );
    const row = latest.current.rows[0];
    expect(row.type === 'amplify' && row.pinnedApps).toEqual([
      { region: 'us-east-1', appId: 'a1', credentialId: 'k1' },
    ]);
    choose(
      screen.getByRole('combobox', { name: 'AWS key for site pinned app a1' }),
      'No key (serves any cell no keyed pin does)',
    );
    const back = latest.current.rows[0];
    expect(back.type === 'amplify' && back.pinnedApps).toEqual([
      { region: 'us-east-1', appId: 'a1' },
    ]);
  });
});

describe('cellSettingsAt', () => {
  it('lists what a cell reads, with each origin', () => {
    expect(cellSettingsAt(start, cellKey('site', 'prod'))).toEqual([
      { name: 'GitHub token', value: 'org', origin: 'Dashboard Board' },
      {
        name: 'AWS key',
        value: 'None (no default is set)',
        origin: 'Built-in',
      },
      {
        name: 'Amplify status set',
        value: 'Amplify',
        origin: 'Cell site × prod',
      },
    ]);
    expect(cellSettingsAt(start, cellKey('gone', 'prod'))).toEqual([]);
  });

  it("names a cell by its row and stage, or their ids when they're gone", () => {
    expect(cellNames(start, cellKey('site', 'prod'))).toEqual({
      rowName: 'site',
      stageName: 'prod',
    });
    expect(cellNames(start, cellKey('gone', 'away'))).toEqual({
      rowName: 'gone',
      stageName: 'away',
    });
  });
});
