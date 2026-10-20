/**
 * Tests for status-set choices below the dashboard: each offers *inherit*
 * named after what it would inherit; choosing at the row changes what its
 * cells inherit; a group chooses per provider.
 *
 * @module
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { type Dashboard, DashboardSchema } from '@/domain/config/dashboard';
import { branchRules } from '@/domain/config/placement';
import { PRESET_IDS } from '@/domain/config/statusSets';
import { choose, optionsOf } from '@/test/choose';

import { GroupStatusSets, RowStatusSets } from './StatusSetOverrides';

const base = DashboardSchema.parse({
  id: 'd',
  name: 'D',
  stages: [{ id: 'dev', name: 'Dev', rules: branchRules('dev') }],
  rows: [{ type: 'github', id: 'web', repo: 'acme/web', displayName: 'web' }],
  rowGroups: [{ id: 'g', name: 'Apps', memberIds: ['web'] }],
});

function setup(which: 'row' | 'group') {
  const latest = { current: base };
  function Harness() {
    const [d, setD] = useState<Dashboard>(base);
    latest.current = d;
    return which === 'row' ? (
      <RowStatusSets dashboard={d} row={d.rows[0]} onChange={setD} />
    ) : (
      <GroupStatusSets
        dashboard={d}
        group={d.rowGroups[0]}
        name="Apps"
        onChange={setD}
      />
    );
  }
  render(<Harness />);
  return latest;
}

describe('RowStatusSets', () => {
  it('chooses for the row, which its cells then inherit', () => {
    const latest = setup('row');
    fireEvent.click(screen.getByRole('button', { name: 'Status sets' }));
    const rowChoice = screen.getByLabelText('Status set for web');
    expect(optionsOf(rowChoice)[0]).toBe('Inherit (GitHub deploy and test)');
    choose(rowChoice, 'GitHub single job');
    expect(latest.current.rows[0].statusSet).toBe(PRESET_IDS.githubSingleJob);
    expect(
      screen.getByRole('button', { name: 'Status sets (1)' }),
    ).toBeInTheDocument();
    expect(optionsOf(screen.getByLabelText('Dev status set for web'))[0]).toBe(
      'Inherit (GitHub single job)',
    );
    choose(
      screen.getByLabelText('Status set for web'),
      'Inherit (GitHub deploy and test)',
    );
    expect(latest.current.rows[0].statusSet).toBeUndefined();
  });
});

describe('GroupStatusSets', () => {
  it('chooses per provider', () => {
    const latest = setup('group');
    choose(
      screen.getByLabelText('GitHub status set for Apps'),
      'GitHub single job',
    );
    expect(latest.current.rowGroups[0].statusSets).toEqual({
      github: PRESET_IDS.githubSingleJob,
    });
    expect(
      optionsOf(screen.getByLabelText('Amplify status set for Apps'))[0],
    ).toBe('Inherit (Amplify)');
  });
});
