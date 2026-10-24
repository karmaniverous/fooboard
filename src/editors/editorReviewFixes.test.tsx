/**
 * Tests for editor fixes from review: unpinning an Amplify app asks
 * first, and a repo-less row's last pin can't be unpinned; a failed repo list retries; the same repo can be
 * added twice. (The Amplify app picker's tests are in
 * `amplifyPicker.test.tsx`.)
 *
 * @module
 */
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { fetched, ghRepo } from '@/test/fakeReaders';

import { setup, tab } from './editorSectionsHarness';

describe('editor review fixes', () => {
  it('retries a failed repo list', async () => {
    let calls = 0;
    setup({
      reposPage: () =>
        ++calls === 1
          ? Promise.reject(new Error('Bad gateway'))
          : Promise.resolve(fetched([ghRepo('acme/api')])),
    });
    tab('Rows');
    fireEvent.click(screen.getByRole('button', { name: 'Add a GitHub row' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Bad gateway');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(
      await screen.findByRole('button', { name: 'acme/api' }),
    ).toBeInTheDocument();
  });

  it('adds the same repo twice as independent rows', async () => {
    const latest = setup({
      reposPage: () => Promise.resolve(fetched([ghRepo('acme/api')])),
    });
    tab('Rows');
    fireEvent.click(screen.getByRole('button', { name: 'Add a GitHub row' }));
    fireEvent.click(await screen.findByRole('button', { name: 'acme/api' }));
    const rows = latest.current.rows.filter((r) => r.repo === 'acme/api');
    expect(rows.map((r) => r.id)).toEqual(['api', 'api-2']);

    // The new row opens (one row at a time); its rule is its own.
    const group = screen.getByRole('group', { name: 'Record rule for api' });
    fireEvent.click(within(group).getByRole('button', { name: 'Add check' }));
    const checks = latest.current.rows
      .filter((r) => r.repo === 'acme/api')
      .map((r) => r.recordRule?.checks.length ?? 0);
    expect(checks).toEqual([0, 1]);
  });

  it('asks before unpinning an Amplify app', async () => {
    const latest = setup();
    tab('Rows');
    fireEvent.click(screen.getByRole('button', { name: 'List Amplify apps' }));
    fireEvent.click(await screen.findByRole('button', { name: /site/ }));
    fireEvent.change(screen.getByLabelText('Region for a new site pin'), {
      target: { value: 'eu-west-1' },
    });
    fireEvent.change(screen.getByLabelText('App ID for a new site pin'), {
      target: { value: 'a9' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Pin' }));
    const pins = () => {
      const row = latest.current.rows.at(-1);
      return row?.type === 'amplify' ? row.pinnedApps.length : 0;
    };
    expect(pins()).toBe(2);
    fireEvent.click(screen.getAllByRole('button', { name: 'Unpin' })[0]);
    expect(pins()).toBe(2);
    fireEvent.click(screen.getByRole('button', { name: 'Unpin a1' }));
    expect(pins()).toBe(1);
    // A row without a repo keeps its last pin.
    const row = latest.current.rows.at(-1);
    expect(row?.repo === undefined).toBe(
      screen.queryByRole('button', { name: 'Unpin' }) === null,
    );
  });
});
