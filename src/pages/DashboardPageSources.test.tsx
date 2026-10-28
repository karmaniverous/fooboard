/**
 * Tests for editing an existing Amplify source on the dashboard page:
 * changing one source's AWS key override saves the dashboard with only
 * that source changed, and the board reads the row again with the newly
 * chosen key.
 *
 * @module
 */
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { branchRules } from '@/domain/config/placement';
import { choose } from '@/test/choose';
import { expand } from '@/test/openItem';
import { renderDashboardPage } from '@/test/renderDashboardPage';

/** The AWS keys whose Amplify readers the board asked for, in order. */
const { readsBy } = vi.hoisted(() => ({ readsBy: [] as string[] }));

// The page builds its providers from the credential store; these stand
// in for them, recording which AWS key each Amplify read used.
vi.mock('@/engine/credentialProviders', async () => {
  const { fakeAmplifyReader } = await import('@/test/fakeReaders');
  return {
    credentialProviders: () => ({
      github: () => undefined,
      fingerprint: () => 'secret',
      amplify: (credentialId: string) => () =>
        fakeAmplifyReader({
          listBranches: () => {
            readsBy.push(credentialId);
            return Promise.resolve([]);
          },
        }),
    }),
  };
});

const KEY_LABEL = 'AWS key for Row site';

describe('DashboardPage Amplify pinned apps', () => {
  it("saves a row's AWS key and reads the pin serving it, with it", async () => {
    const keyed = { credentialId: 'aws2', region: 'eu-west-1', appId: 'a2' };
    const stores = await renderDashboardPage({
      id: 'd',
      name: 'D',
      credentials: [
        { id: 'aws1', kind: 'aws', label: 'first' },
        { id: 'aws2', kind: 'aws', label: 'second' },
      ],
      settings: { awsKey: 'aws1' },
      rows: [
        {
          type: 'amplify',
          id: 'site',
          repo: 'acme/site',
          displayName: 'site',
          pinnedApps: [{ region: 'us-east-1', appId: 'a1' }, keyed],
        },
      ],
      stages: [{ id: 'dev', name: 'Dev', rules: branchRules('dev') }],
    });
    // aws1 has no keyed pin: the unkeyed one serves it.
    await waitFor(() => {
      expect(new Set(readsBy)).toEqual(new Set(['aws1']));
    });

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const editor = screen.getByRole('dialog', { name: 'Edit dashboard' });
    fireEvent.mouseDown(within(editor).getByRole('tab', { name: 'Rows' }), {
      button: 0,
    });
    expand('site');
    expand('Settings');
    readsBy.length = 0;
    choose(screen.getByRole('combobox', { name: KEY_LABEL }), 'second');

    const loaded = stores.config.load();
    expect(
      loaded.kind === 'ok' && loaded.root.dashboards[0]?.rows[0],
    ).toMatchObject({ settings: { awsKey: 'aws2' } });
    await waitFor(() => {
      expect(new Set(readsBy)).toEqual(new Set(['aws2']));
    });
    expect(
      screen.getByRole('combobox', { name: KEY_LABEL, hidden: true }),
    ).toHaveTextContent('second');
  });
});
