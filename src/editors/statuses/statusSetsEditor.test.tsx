/**
 * Tests for the Statuses tab: customising copies the chosen set and
 * chooses the copy; its statuses can be renamed, reordered and given a
 * test from the form; a chosen set can't be removed.
 *
 * @module
 */
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { choose } from '@/test/choose';

import { setup, tab } from '../editorSectionsHarness';

describe('Statuses tab', () => {
  it('customises a set, edits its statuses and keeps it while chosen', () => {
    const latest = setup();
    tab('Statuses');
    fireEvent.click(screen.getAllByRole('button', { name: 'Customise' })[1]);
    expect(latest.current.statusSets.amplify).toBe('custom-amplify');
    const set = screen.getByRole('region', {
      name: 'Status set Amplify (custom)',
    });
    expect(within(set).getByRole('button', { name: 'Remove' })).toBeDisabled();

    fireEvent.click(within(set).getByRole('button', { name: 'Add status' }));
    const added = within(set).getByRole('group', {
      name: 'Cell status New status',
    });
    const name = within(added).getByLabelText('Cell status 1 name');
    fireEvent.change(name, { target: { value: 'Building' } });
    fireEvent.blur(name);
    const [first] = latest.current.customStatusSets[0]?.cell ?? [];
    expect(first.name).toBe('Building');
    // A new status matches nothing until its rule is written.
    expect(first.rule.checks[0]).toMatchObject({
      path: '$',
      operator: 'exists',
      not: true,
    });

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
    choose(screen.getByLabelText('Amplify status set'), 'Amplify');
    const set = screen.getByRole('region', {
      name: 'Status set Amplify (custom)',
    });
    fireEvent.click(within(set).getByRole('button', { name: 'Remove' }));
    expect(latest.current.customStatusSets).toEqual([]);
    expect(latest.current.statusSets.amplify).toBe('amplify');
  });
});
