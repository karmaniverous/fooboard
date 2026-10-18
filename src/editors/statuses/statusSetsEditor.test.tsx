/**
 * Tests for the Statuses tab: customising copies the chosen set and
 * chooses the copy; its statuses can be renamed, reordered and given a
 * test from the form; a chosen set can't be removed.
 *
 * @module
 */
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

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
    // A new status matches nothing: its test is JSON-only until rewritten.
    expect(first.test).toEqual({ not: {} });

    fireEvent.click(
      within(set).getByRole('button', { name: 'Move Building down' }),
    );
    expect(latest.current.customStatusSets[0]?.cell[1]?.name).toBe('Building');
  });

  it('writes a condition from the form as JSON Schema', () => {
    const latest = setup();
    tab('Statuses');
    fireEvent.click(screen.getAllByRole('button', { name: 'Customise' })[1]);
    const set = screen.getByRole('region', {
      name: 'Status set Amplify (custom)',
    });
    const [first] = latest.current.customStatusSets[0]?.cell ?? [];
    const value = within(set).getByLabelText(
      `${first.name} test condition 1 value`,
    );
    fireEvent.change(value, { target: { value: 'FAILED' } });
    fireEvent.blur(value);
    expect(latest.current.customStatusSets[0]?.cell[0]?.test).toEqual({
      type: 'object',
      properties: { status: { enum: ['FAILED'] } },
      required: ['status'],
    });
  });
});
