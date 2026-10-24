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

const SOURCE_LABEL = 'AWS key for site source a1';

describe('DashboardPage Amplify sources', () => {
  it('saves a changed key override and reads the changed source with it', async () => {
    const other = { credentialId: 'aws1', region: 'eu-west-1', appId: 'a2' };
    const stores = await renderDashboardPage({
      id: 'd',
      name: 'D',
      credentials: [
        { id: 'aws1', kind: 'aws', label: 'first' },
        { id: 'aws2', kind: 'aws', label: 'second' },
      ],
      defaultCredentials: { aws: 'aws1' },
      rows: [
        {
          type: 'amplify',
          id: 'site',
          repo: 'acme/site',
          displayName: 'site',
          sources: [{ region: 'us-east-1', appId: 'a1' }, other],
        },
      ],
      stages: [{ id: 'dev', name: 'Dev', rules: branchRules('dev') }],
    });
    await waitFor(() => {
      expect(new Set(readsBy)).toEqual(new Set(['aws1']));
    });

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const editor = screen.getByRole('dialog', { name: 'Edit dashboard' });
    fireEvent.mouseDown(within(editor).getByRole('tab', { name: 'Rows' }), {
      button: 0,
    });
    expand('site');
    readsBy.length = 0;
    choose(screen.getByRole('combobox', { name: SOURCE_LABEL }), 'second');

    const loaded = stores.config.load();
    expect(
      loaded.kind === 'ok' && loaded.root.dashboards[0]?.rows[0],
    ).toMatchObject({
      sources: [
        { credentialId: 'aws2', region: 'us-east-1', appId: 'a1' },
        other,
      ],
    });
    // Only the changed source reads again: the unchanged one's queries
    // keep their key (credential, region, app), so the cache serves it.
    await waitFor(() => {
      expect(new Set(readsBy)).toEqual(new Set(['aws2']));
    });
    expect(
      screen.getByRole('combobox', { name: SOURCE_LABEL, hidden: true }),
    ).toHaveTextContent('second');
  });
});
