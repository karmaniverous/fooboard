/**
 * Tests for editor fixes from review: deleting an Amplify source asks
 * first; a failed repo list retries; the same repo can be
 * added twice; listed apps hide when the region changes; a region with
 * no apps says so.
 *
 * @module
 */
import { act, fireEvent, screen, within } from '@testing-library/react';
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
    const group = screen.getByRole('group', { name: 'Item rule for api' });
    fireEvent.click(within(group).getByRole('button', { name: 'Add check' }));
    const checks = latest.current.rows
      .filter((r) => r.repo === 'acme/api')
      .map((r) => r.itemRule?.checks.length ?? 0);
    expect(checks).toEqual([0, 1]);
  });

  it('hides listed apps when the region changes, before or after the response', async () => {
    const latest = setup();
    tab('Rows');
    const region = screen.getByLabelText('Region');
    // Changed while the request is pending.
    fireEvent.click(screen.getByRole('button', { name: 'List Amplify apps' }));
    fireEvent.change(region, { target: { value: 'eu-west-1' } });
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.queryByRole('button', { name: /site/ })).toBeNull();

    // Listed for eu-west-1, then changed after the response.
    fireEvent.click(screen.getByRole('button', { name: 'List Amplify apps' }));
    expect(
      await screen.findByRole('button', { name: /site/ }),
    ).toBeInTheDocument();
    fireEvent.change(region, { target: { value: 'us-west-2' } });
    expect(screen.queryByRole('button', { name: /site/ })).toBeNull();

    fireEvent.change(region, { target: { value: 'eu-west-1' } });
    fireEvent.click(screen.getByRole('button', { name: /site/ }));
    expect(latest.current.rows.at(-1)).toMatchObject({
      sources: [{ region: 'eu-west-1', appId: 'a1' }],
    });
  });

  it('says when the listed region has no apps', async () => {
    setup({}, { listApps: () => Promise.resolve([]) });
    tab('Rows');
    fireEvent.change(screen.getByLabelText('Region'), {
      target: { value: 'eu-north-1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'List Amplify apps' }));
    const empty = await screen.findByText('No apps in eu-north-1.');
    const list = empty.closest('ul');
    if (!list) throw new Error('the message is not in the app list');
    expect(within(list).getAllByRole('listitem')).toEqual([empty]);
  });

  it('asks before deleting an Amplify source', async () => {
    const latest = setup();
    tab('Rows');
    fireEvent.click(screen.getByRole('button', { name: 'List Amplify apps' }));
    fireEvent.click(await screen.findByRole('button', { name: /site/ }));
    fireEvent.change(screen.getByLabelText('Region for a new site source'), {
      target: { value: 'eu-west-1' },
    });
    fireEvent.change(screen.getByLabelText('App ID for a new site source'), {
      target: { value: 'a9' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add source' }));
    const sources = () => {
      const row = latest.current.rows.at(-1);
      return row?.type === 'amplify' ? row.sources.length : 0;
    };
    expect(sources()).toBe(2);
    fireEvent.click(
      screen.getAllByRole('button', {
        name: 'Delete source',
      })[0],
    );
    expect(sources()).toBe(2);
    fireEvent.click(screen.getByRole('button', { name: 'Delete source a1' }));
    expect(sources()).toBe(1);
  });
});
