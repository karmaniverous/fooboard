/**
 * Tests for the notes of the app search (spec.md §3.12): a pin that is
 * the only app its key's search finds building the row's repo gets a
 * note offering *Unpin* (and no other pin does); the regions a key's
 * search skipped for a denial or an opt-in server error are named in one
 * dashboard note, the silent skips left out.
 *
 * @module
 */
import { QueryClient } from '@tanstack/query-core';
import { describe, expect, it } from 'vitest';

import type { AmplifyRow } from '@/domain/config/row';
import {
  amplifyCtx as ctx,
  AWS,
  listedApp,
  rowOf,
  seedSearch,
} from '@/test/amplifyRows';

import { deriveAmplifyRow } from './amplifyRow';

const MARKETING = { region: 'us-east-1', appId: 'd1demomarketing' };
const REPO = 'acme/marketing-site';

const notes = (
  client: QueryClient,
  row: AmplifyRow = rowOf('marketing-site'),
) =>
  deriveAmplifyRow(ctx(client), row).problems.filter(
    (p) => p.severity === 'note',
  );

describe('the Unpin note', () => {
  it('offers Unpin on a pin the search alone would find', () => {
    const client = new QueryClient();
    seedSearch(client, AWS, {
      'us-east-1': [listedApp(MARKETING.appId, REPO)],
    });
    expect(notes(client)).toEqual([
      expect.objectContaining({
        message: `Amplify app ${MARKETING.appId} (us-east-1) is the only app building ${REPO} in the account of the AWS key key ${AWS}, so the row finds it without the pin: unpin it to follow the repo`,
        dismissable: true,
        level: { kind: 'row', id: 'marketing-site' },
        target: { kind: 'row', id: 'marketing-site', part: 'pinnedApps' },
        actions: [
          {
            kind: 'unpin',
            rowId: 'marketing-site',
            pin: MARKETING,
            label: `Unpin ${MARKETING.appId}`,
          },
        ],
      }),
    ]);
  });

  it.each([
    [
      'the search finds another app too',
      { 'eu-west-1': [listedApp('twin', REPO)] },
    ],
    [
      'the search finds the app in another region',
      { 'us-east-1': [], 'eu-west-1': [listedApp(MARKETING.appId, REPO)] },
    ],
  ])('offers nothing when %s', (_, extra) => {
    const client = new QueryClient();
    seedSearch(client, AWS, {
      'us-east-1': [listedApp(MARKETING.appId, REPO)],
      ...extra,
    });
    expect(notes(client)).toEqual([]);
  });

  it('offers nothing before the search is done, or for a row without a repo', () => {
    expect(notes(new QueryClient())).toEqual([]);
    const client = new QueryClient();
    seedSearch(client, AWS, {
      'us-east-1': [listedApp(MARKETING.appId, REPO)],
    });
    expect(
      notes(client, { ...rowOf('marketing-site'), repo: undefined }),
    ).toEqual([]);
  });

  it('offers nothing on one of several pins for the key', () => {
    const client = new QueryClient();
    seedSearch(client, AWS, {
      'us-east-1': [listedApp(MARKETING.appId, REPO)],
    });
    const row: AmplifyRow = {
      ...rowOf('marketing-site'),
      pinnedApps: [MARKETING, { region: 'eu-west-1', appId: 'second' }],
    };
    expect(notes(client, row)).toEqual([]);
  });

  it('offers nothing on a pin no cell reads with', () => {
    const client = new QueryClient();
    seedSearch(client, AWS, {
      'us-east-1': [listedApp(MARKETING.appId, REPO)],
    });
    const row: AmplifyRow = {
      ...rowOf('marketing-site'),
      pinnedApps: [
        { ...MARKETING, credentialId: AWS },
        { ...MARKETING, credentialId: 'unused-key' },
      ],
    };
    expect(notes(client, row).map((n) => n.actions?.[0]?.pin)).toEqual([
      { ...MARKETING, credentialId: AWS },
    ]);
  });
});

describe('the skipped-regions note', () => {
  it('names the denied and unreachable regions in region order, once per key, on the dashboard', () => {
    const client = new QueryClient();
    seedSearch(client, AWS, {
      'us-west-1': { apps: [], skipped: 'unavailable' },
      'ap-south-1': { apps: [], skipped: 'denied' },
      'me-south-1': { apps: [], skipped: 'unreachable' },
    });
    const regionNotes = notes(client).filter(
      (n) => n.level.kind === 'dashboard',
    );
    expect(regionNotes).toEqual([
      expect.objectContaining({
        message: `The Amplify app search under the AWS key key ${AWS} skipped me-south-1 (it didn't answer), ap-south-1 (an AWS organisation's policy denies it), so apps there can't be seen`,
        dismissable: true,
        target: {
          kind: 'settings',
          place: { level: 'dashboard' },
          field: 'awsKey',
        },
      }),
    ]);
    // Both demo Amplify rows read with the key: the same note, one id.
    const other = notes(client, rowOf('partner-portal')).filter(
      (n) => n.level.kind === 'dashboard',
    );
    expect(other.map((n) => n.id)).toEqual(regionNotes.map((n) => n.id));
  });

  it('says nothing when only silent skips happened', () => {
    const client = new QueryClient();
    seedSearch(client, AWS, {
      'eu-south-1': { apps: [], skipped: 'unavailable' },
    });
    expect(notes(client)).toEqual([]);
  });
});
