/**
 * Tests for the Statuses tab: customising copies the chosen set and
 * chooses the copy; its statuses can be renamed, reordered and given a
 * test from the form; a chosen set can't be removed.
 *
 * @module
 */
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { never } from '@/domain/model/ruleBuilders';
import { choose } from '@/test/choose';
import { expand } from '@/test/openItem';

import { setup, start, tab } from '../editorSectionsHarness';

describe('Statuses tab', () => {
  it('says which set the dashboard uses: the built-in, its own choice, or an unknown id', () => {
    setup(undefined, undefined, {
      ...start,
      settings: { ...start.settings, statusSets: { github: 'gone' } },
    });
    tab('Statuses');
    expect(screen.getByText('gone')).toBeVisible();
    expect(screen.getByText('Built-in (Amplify)')).toBeVisible();
    expect(
      screen.getAllByText(/^Chosen in Settings on the General tab/),
    ).toHaveLength(2);
  });

  it('customises a set, edits its statuses and keeps it while chosen', () => {
    const latest = setup();
    tab('Statuses');
    fireEvent.click(screen.getAllByRole('button', { name: 'Customise' })[1]);
    expect(latest.current.settings.statusSets?.amplify).toBe('custom-amplify');
    const set = screen.getByRole('region', {
      name: 'Status set Amplify (custom)',
    });
    expect(within(set).getByRole('button', { name: 'Remove' })).toBeDisabled();

    fireEvent.click(within(set).getByRole('button', { name: 'Add status' }));
    // A new status opens.
    const added = within(set).getByRole('region', {
      name: 'Cell status New status',
    });
    const name = within(added).getByLabelText('Cell status 1 name');
    fireEvent.change(name, { target: { value: 'Building' } });
    fireEvent.blur(name);
    const [first] = latest.current.customStatusSets[0]?.cell ?? [];
    expect(first.name).toBe('Building');
    // A new status matches nothing until its rule is written.
    expect(first.rule).toEqual(never);

    fireEvent.click(
      within(set).getByRole('button', { name: 'Move Building down' }),
    );
    expect(latest.current.customStatusSets[0]?.cell[1]?.name).toBe('Building');
  });

  it('edits a status rule', () => {
    const latest = setup();
    tab('Statuses');
    fireEvent.click(screen.getAllByRole('button', { name: 'Customise' })[1]);
    const set = screen.getByRole('region', {
      name: 'Status set Amplify (custom)',
    });
    const [first] = latest.current.customStatusSets[0]?.cell ?? [];
    expand(first.name);
    const value = within(set).getByLabelText(
      `${first.name} rule check 1 value`,
    );
    fireEvent.change(value, { target: { value: 'fail*' } });
    fireEvent.blur(value);
    expect(
      latest.current.customStatusSets[0]?.cell[0]?.rule.checks[0],
    ).toMatchObject({
      path: '$.state',
      value: 'fail*',
    });
  });

  it('removes a custom set once nothing chooses it', () => {
    const latest = setup();
    tab('Statuses');
    fireEvent.click(screen.getAllByRole('button', { name: 'Customise' })[1]);
    // Choosing the preset again is the dashboard's settings' to do.
    tab('General');
    expand('Settings');
    choose(
      screen.getByRole('combobox', {
        name: 'Amplify status set for Dashboard Board',
      }),
      'Amplify',
    );
    tab('Statuses');
    const set = screen.getByRole('region', {
      name: 'Status set Amplify (custom)',
    });
    fireEvent.click(within(set).getByRole('button', { name: 'Remove' }));
    expect(latest.current.customStatusSets).toEqual([]);
    expect(latest.current.settings.statusSets?.amplify).toBe('amplify');
  });
});
