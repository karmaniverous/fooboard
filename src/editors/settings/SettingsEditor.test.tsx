/**
 * Tests for the settings editor (spec.md §3.11, Decisions 52–53): every
 * field offered at a place, in order; an inherited value shown as the
 * control's value with its origin; choosing a value sets it here (*Set
 * here*), *Reset to inherited* names the fallback and removes it; the
 * places that win over a set field; *nothing here reads it yet*; an item
 * rule set here from its inherited summary; and the disclosure's count.
 *
 * @module
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { type Dashboard, DashboardSchema } from '@/domain/config/dashboard';
import type { SettingsPlace } from '@/domain/settings/places';
import { choose, optionsOf } from '@/test/choose';

import { NOTHING_READS } from './SettingEntry';
import { SettingsEditor } from './SettingsEditor';

const start = DashboardSchema.parse({
  id: 'd',
  name: 'Board',
  credentials: [
    { id: 'org', kind: 'github', label: 'org' },
    { id: 'team', kind: 'github', label: 'team' },
    { id: 'k1', kind: 'aws', label: 'k1' },
    { id: 'k2', kind: 'aws', label: 'k2' },
  ],
  stages: [
    { id: 'dev', name: 'dev' },
    { id: 'prod', name: 'prod', settings: { awsKey: 'k2' } },
  ],
  rows: [
    { type: 'github', id: 'api', repo: 'acme/api', displayName: 'api' },
    {
      type: 'amplify',
      id: 'site',
      repo: 'acme/site',
      displayName: 'site',
      pinnedApps: [{ region: 'us-east-1', appId: 'a1' }],
    },
  ],
  rowGroups: [
    {
      id: 'back',
      label: 'Back',
      memberIds: ['api'],
      settings: { githubToken: 'team' },
    },
  ],
});

function setup(place: SettingsPlace, first: Dashboard = start) {
  const latest = { current: first };
  function Harness(): React.JSX.Element {
    const [d, setD] = useState(first);
    return (
      <SettingsEditor
        dashboard={d}
        place={place}
        onChange={(next) => {
          latest.current = next;
          setD(next);
        }}
      />
    );
  }
  render(<Harness />);
  fireEvent.click(screen.getByRole('button', { name: /^Settings/ }));
  return latest;
}

/** The entry holding the control or button named `name`. */
const entryOf = (name: string) => {
  const control = screen.getByRole('combobox', { name });
  const entry = control.closest('[data-edit-target]');
  if (!(entry instanceof HTMLElement)) throw new Error('no entry');
  return entry;
};

describe('SettingsEditor', () => {
  it('lists every field settable at the dashboard, in order, with the built-ins', () => {
    setup({ level: 'dashboard' });
    // A trigger's text begins with what it shows; its options follow.
    expect(
      screen
        .getAllByRole('combobox')
        .map((c) => [
          c.getAttribute('aria-label'),
          optionsOf(c).find((o) => c.textContent.startsWith(o)),
        ]),
    ).toEqual([
      ['GitHub token for Dashboard Board', 'None (no default is set)'],
      ['AWS key for Dashboard Board', 'None (no default is set)'],
      [
        'GitHub status set for Dashboard Board',
        'Built-in (GitHub deploy and test)',
      ],
      ['Amplify status set for Dashboard Board', 'Built-in (Amplify)'],
    ]);
    // The GitHub item rule: its source rule reads items; Amplify's doesn't.
    expect(screen.getByText('Every item counts')).toBeInTheDocument();
  });

  it('shows an inherited value with its origin, sets a choice here, and resets it', () => {
    const latest = setup({ level: 'row', rowId: 'api' });
    const token = screen.getByRole('combobox', {
      name: 'GitHub token for Row api',
    });
    expect(token).toHaveTextContent('Row group default (team)');
    expect(
      within(entryOf('GitHub token for Row api')).getByText('from Back'),
    ).toBeVisible();
    expect(optionsOf(token)).toEqual([
      'Row group default (team)',
      'org',
      'team',
    ]);

    // Choosing the inherited value still sets it here.
    choose(token, 'team');
    expect(latest.current.rows[0]?.settings).toEqual({ githubToken: 'team' });
    const entry = entryOf('GitHub token for Row api');
    expect(within(entry).getByText('Set here')).toBeVisible();
    expect(
      within(entry).getByText('falls back to Row group default (team)'),
    ).toBeVisible();
    expect(within(entry).queryByText('from Back')).toBeNull();

    fireEvent.click(
      within(entry).getByRole('button', {
        name: 'Reset to inherited: GitHub token for Row api',
      }),
    );
    expect(latest.current.rows[0]?.settings).toEqual({});
    expect(
      within(entryOf('GitHub token for Row api')).queryByText('Set here'),
    ).toBeNull();
  });

  it('names the places that win over a set field', () => {
    setup({ level: 'row', rowId: 'site' });
    choose(
      screen.getByRole('combobox', { name: 'AWS key for Row site' }),
      'k1',
    );
    expect(
      screen.getByText('prod sets its own AWS key, which wins there'),
    ).toBeVisible();
  });

  it('marks a field no row under the place reads, keeping its control usable', () => {
    const latest = setup({ level: 'rowGroup', groupId: 'back' });
    const aws = entryOf('AWS key for Row group Back');
    expect(within(aws).getByText(NOTHING_READS)).toBeVisible();
    expect(
      within(entryOf('GitHub token for Row group Back')).queryByText(
        NOTHING_READS,
      ),
    ).toBeNull();
    choose(
      screen.getByRole('combobox', { name: 'AWS key for Row group Back' }),
      'k1',
    );
    expect(latest.current.rowGroups[0]?.settings.awsKey).toBe('k1');
  });

  it('sets an item rule here from its inherited summary, and counts it', () => {
    const latest = setup({ level: 'column', stageId: 'dev' });
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Set here: GitHub item rule for Column dev',
      }),
    );
    expect(latest.current.stages[0]?.settings).toEqual({
      itemRules: { github: { combine: 'and', checks: [] } },
    });
    expect(
      screen.getByRole('group', { name: 'GitHub item rule for Column dev' }),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: /^Settings/ })).toHaveTextContent(
      'Settings (1)',
    );
  });

  it('shows a value naming no credential, and copies an inherited rule to set it here', () => {
    const rule = { combine: 'and', checks: [] } as const;
    const latest = setup(
      { level: 'row', rowId: 'api' },
      {
        ...start,
        settings: {
          ...start.settings,
          itemRules: {
            github: {
              ...rule,
              checks: [
                {
                  path: '$.name',
                  operator: 'glob',
                  value: 'x',
                  ignoreCase: true,
                  quantifier: 'any',
                  not: false,
                },
              ],
            },
          },
        },
        rows: [
          { ...start.rows[0], settings: { githubToken: 'gone' } },
          start.rows[1],
        ],
      },
    );
    expect(
      screen.getByRole('combobox', { name: 'GitHub token for Row api' }),
    ).toHaveTextContent('gone (not on this dashboard)');
    expect(
      screen.getByText('Dashboard default ($.name matches x)'),
    ).toBeVisible();
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Set here: GitHub item rule for Row api',
      }),
    );
    expect(latest.current.rows[0]?.settings.itemRules).toEqual(
      latest.current.settings.itemRules,
    );
  });

  it("offers a cell only its row's fields", () => {
    setup({ level: 'cell', rowId: 'api', stageId: 'prod' });
    expect(
      screen.getAllByRole('combobox').map((c) => c.getAttribute('aria-label')),
    ).toEqual([
      'GitHub token for Cell api × prod',
      'GitHub status set for Cell api × prod',
    ]);
  });
});
