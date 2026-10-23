/**
 * Tests for the Amplify app picker (spec.md C-21, Decision 21): it lists
 * an AWS key's apps in every region, each marked with its region; an app
 * with a GitHub repo adds at once, and one without asks for the repo,
 * typed in or left empty; listed apps hide when the key changes; no apps
 * anywhere says so; a rejected key is reported.
 *
 * @module
 */
import { act, fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DashboardSchema } from '@/domain/config/dashboard';
import { AmplifyAuthError } from '@/lib/amplify/errors';
import { amplifyApp } from '@/lib/amplify/sdkShapes';
import { choose } from '@/test/choose';

import { type ListAppsIn, setup, start, tab } from './editorSectionsHarness';

const list = () => {
  fireEvent.click(screen.getByRole('button', { name: 'List Amplify apps' }));
};

const site = amplifyApp({
  appId: 'a1',
  name: 'site',
  repository: 'https://github.com/acme/site',
});

describe('the Amplify app picker', () => {
  it('lists apps from several regions, marking each app with its region', async () => {
    const latest = setup();
    tab('Rows');
    list();
    const site = await screen.findByRole('button', {
      name: 'site us-east-1 (acme/site)',
    });
    expect(
      screen.getByRole('button', {
        name: 'orphan eu-west-1 (no GitHub repo)',
      }),
    ).toBeInTheDocument();
    fireEvent.click(site);
    expect(latest.current.rows.at(-1)).toMatchObject({
      type: 'amplify',
      id: 'site',
      repo: 'acme/site',
      displayName: 'site',
      sources: [{ region: 'us-east-1', appId: 'a1' }],
    });
  });

  it('adds an app without a GitHub repo with a typed repo, and with none', async () => {
    const latest = setup();
    tab('Rows');
    list();
    const orphan = await screen.findByRole('button', {
      name: /^orphan eu-west-1/,
    });
    fireEvent.click(orphan);
    expect(orphan).toHaveAttribute('aria-expanded', 'true');
    const repo = screen.getByLabelText('GitHub repo for orphan');
    const add = screen.getByRole('button', { name: 'Add orphan' });
    fireEvent.change(repo, { target: { value: 'not a repo' } });
    expect(add).toBeDisabled();
    expect(
      screen.getByText('Type the repo as owner/name, or leave it empty.'),
    ).toBeInTheDocument();
    fireEvent.change(repo, { target: { value: ' x/y ' } });
    fireEvent.click(add);
    expect(latest.current.rows.at(-1)).toMatchObject({
      id: 'orphan',
      repo: 'x/y',
      sources: [{ region: 'eu-west-1', appId: 'a2' }],
    });
    expect(screen.queryByLabelText('GitHub repo for orphan')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /^orphan eu-west-1/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Add orphan' }));
    const none = latest.current.rows.at(-1);
    expect(none).toMatchObject({ id: 'orphan-2', displayName: 'orphan' });
    expect(none && 'repo' in none).toBe(false);
    expect(
      document.querySelector('[data-edit-target="row:orphan-2"]'),
    ).toHaveTextContent('Amplify · no GitHub repo');
    // Without a repo there is no GitHub token to choose for it.
    expect(screen.queryByLabelText('GitHub token for orphan')).toBeNull();
    expect(screen.getByLabelText('Display name for orphan-2')).toHaveValue(
      'orphan',
    );
  });

  it('hides listed apps when the AWS key changes, before or after the response', async () => {
    const twoKeys = DashboardSchema.parse({
      ...start,
      credentials: [
        ...start.credentials,
        { id: 'aws2', kind: 'aws', label: 'other' },
      ],
    });
    const latest = setup(
      {},
      (region) => Promise.resolve(region === 'us-east-1' ? [site] : []),
      twoKeys,
    );
    tab('Rows');
    const key = screen.getByLabelText('AWS key for the new Amplify row');
    // Changed while the request is pending.
    list();
    choose(key, 'other');
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.queryByRole('button', { name: /^site/ })).toBeNull();

    // Listed with `other`, then changed after the response.
    list();
    expect(
      await screen.findByRole('button', { name: /^site/ }),
    ).toBeInTheDocument();
    choose(key, 'Dashboard default (aws)');
    expect(screen.queryByRole('button', { name: /^site/ })).toBeNull();

    choose(key, 'other');
    fireEvent.click(screen.getByRole('button', { name: /^site us-east-1/ }));
    expect(latest.current.rows.at(-1)).toMatchObject({
      sources: [{ credentialId: 'aws2', region: 'us-east-1', appId: 'a1' }],
    });
  });

  it('says when no region has apps', async () => {
    setup({}, () => Promise.resolve([]));
    tab('Rows');
    list();
    const empty = await screen.findByText('No apps in any Amplify region.');
    const items = empty.closest('ul');
    if (!items) throw new Error('the message is not in the app list');
    expect(within(items).getAllByRole('listitem')).toEqual([empty]);
  });

  it('skips an opt-in region that rejects the key', async () => {
    const optInRejects: ListAppsIn = (region) =>
      region === 'me-south-1'
        ? Promise.reject(new AmplifyAuthError('not enabled', 'ListApps'))
        : Promise.resolve(
            region === 'us-east-1'
              ? [amplifyApp({ appId: 'a1', name: 'site' })]
              : [],
          );
    setup({}, optInRejects);
    tab('Rows');
    list();
    expect(
      await screen.findByRole('button', { name: /^site us-east-1/ }),
    ).toBeInTheDocument();
  });

  it('reports a key rejected in a region every account has', async () => {
    setup({}, (region) =>
      region === 'eu-west-1'
        ? Promise.reject(
            new AmplifyAuthError('denied in eu-west-1', 'ListApps'),
          )
        : Promise.resolve([]),
    );
    tab('Rows');
    list();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'denied in eu-west-1',
    );
  });
});
