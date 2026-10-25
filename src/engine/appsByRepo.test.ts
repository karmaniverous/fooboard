/**
 * Tests for apps found by repo (spec.md §3.12): a row with a repo and no
 * pin for its key reads the apps its key's search finds building the
 * repo; until every region answers its cells load; a failed region shows
 * *Error* naming it (a rejected key *Needs credential*); no match shows
 * *No app* with its problem per key naming the columns; several matches
 * are all read, with *Pin* on each; pins win over the search; and the
 * search runs for pinned rows too.
 *
 * @module
 */
import { QueryClient } from '@tanstack/query-core';
import { describe, expect, it } from 'vitest';

import { measureBoard } from '@/demo/scenarios/measure';
import type { Dashboard } from '@/domain/config/dashboard';
import type { AmplifyRow } from '@/domain/config/row';
import { EMPTY_STATES } from '@/domain/derivation';
import { AmplifyAuthError } from '@/lib/amplify/errors';
import {
  amplifyCtx as ctx,
  AWS,
  listedApp,
  rowOf,
  seedApp,
  seedSearch,
  seedSearchError,
} from '@/test/amplifyRows';

import { deriveAmplifyRow } from './amplifyRow';

const MARKETING = { region: 'us-east-1', appId: 'd1demomarketing' };
const PARTNER_EU = { region: 'eu-west-1', appId: 'd1demopartnereu' };
const REPO = 'acme/marketing-site';
const stageIds = measureBoard.stages.map((s) => s.id);
const stageNames = measureBoard.stages.map((s) => s.name).join(', ');

/** The demo marketing row, found by repo: no pins. */
const byRepo = (over: Partial<AmplifyRow> = {}): AmplifyRow => ({
  ...rowOf('marketing-site'),
  pinnedApps: [],
  ...over,
});

/** Each need as `call` or `call:appId`. */
const calls = (out: ReturnType<typeof deriveAmplifyRow>) =>
  out.needs.map(({ key: [, , request] }) =>
    'appId' in request ? `${request.call}:${request.appId}` : request.call,
  );

describe('apps found by repo', () => {
  it('loads until every region of the search has answered', () => {
    const client = new QueryClient();
    const out = deriveAmplifyRow(ctx(client), byRepo());
    expect(out.cells).toEqual({});
    expect(out.problems).toEqual([]);
    expect(calls(out).filter((c) => c === 'apps')).toHaveLength(
      ctx(client).search(AWS).needs.length,
    );
  });

  it('reads the app the search finds building the repo, as a pin would', async () => {
    const client = new QueryClient();
    seedSearch(client, AWS, {
      'us-east-1': [
        listedApp(MARKETING.appId, 'Acme/Marketing-Site'),
        listedApp('other', 'acme/elsewhere'),
      ],
    });
    expect(calls(deriveAmplifyRow(ctx(client), byRepo()))).toContain(
      `branches:${MARKETING.appId}`,
    );
    await seedApp(client, MARKETING.region, MARKETING.appId);
    const found = deriveAmplifyRow(ctx(client), byRepo());
    const pinned = deriveAmplifyRow(ctx(client), rowOf('marketing-site'));
    expect(found.cells).toEqual(pinned.cells);
    expect(calls(found)).not.toContain('branches:other');
    expect(found.problems).toEqual([]);
  });

  it('shows No app with its problem per key when no app builds the repo', () => {
    const client = new QueryClient();
    seedSearch(client, AWS, {
      'us-east-1': [listedApp('other', 'acme/elsewhere')],
    });
    const out = deriveAmplifyRow(ctx(client), byRepo());
    for (const id of stageIds)
      expect(out.cells[id]?.derivation).toEqual({
        kind: 'empty',
        state: EMPTY_STATES.noApp,
        reason: `no app builds ${REPO} in this key's account`,
      });
    expect(out.problems).toEqual([
      expect.objectContaining({
        message: `No Amplify app builds ${REPO} in the account of the AWS key key ${AWS}, so ${stageNames} show No app: pin the app, or, if the repo was renamed, update the row's repo`,
        dismissable: true,
        severity: 'problem',
        target: { kind: 'row', id: 'marketing-site', part: 'pinnedApps' },
      }),
    ]);
  });

  it('shows No app when the row has no repo and no pin serves the key', () => {
    const client = new QueryClient();
    seedSearch(client, AWS);
    const row = byRepo({
      repo: undefined,
      pinnedApps: [{ ...MARKETING, credentialId: 'another-key' }],
    });
    const out = deriveAmplifyRow(ctx(client), row);
    expect(out.cells[stageIds[0] ?? '']?.derivation).toMatchObject({
      state: EMPTY_STATES.noApp,
      reason: "no app is pinned for this key's account",
    });
    expect(out.problems.map((p) => p.message)).toContain(
      `No Amplify app is pinned for the AWS key key ${AWS}, and the row has no repo, so ${stageNames} show No app: pin an app for that key`,
    );
  });

  it('reads every app building the repo, offering Pin on each', () => {
    const client = new QueryClient();
    seedSearch(client, AWS, {
      'us-east-1': [listedApp(MARKETING.appId, REPO, 'site')],
      'eu-west-1': [listedApp(PARTNER_EU.appId, `${REPO}.git`, 'site-eu')],
    });
    const out = deriveAmplifyRow(ctx(client), byRepo());
    expect(calls(out)).toEqual(
      expect.arrayContaining([
        `branches:${MARKETING.appId}`,
        `branches:${PARTNER_EU.appId}`,
      ]),
    );
    const several = out.problems.find((p) => p.actions);
    expect(several).toMatchObject({
      message: `2 Amplify apps build ${REPO} in the account of the AWS key key ${AWS}: site (us-east-1), site-eu (eu-west-1). The row reads them all; pin the one it should read`,
      dismissable: true,
      target: { kind: 'row', id: 'marketing-site', part: 'pinnedApps' },
      actions: [
        {
          kind: 'pin',
          rowId: 'marketing-site',
          pin: { credentialId: AWS, ...MARKETING },
          label: 'Pin site (us-east-1)',
        },
        {
          kind: 'pin',
          rowId: 'marketing-site',
          pin: { credentialId: AWS, ...PARTNER_EU },
          label: 'Pin site-eu (eu-west-1)',
        },
      ],
    });
  });

  it('tells apart apps with the same name in the same region', () => {
    const client = new QueryClient();
    seedSearch(client, AWS, {
      'us-east-1': [
        listedApp(MARKETING.appId, REPO, 'site'),
        listedApp('d1sitecopy', REPO, 'site'),
      ],
      'eu-west-1': [listedApp(PARTNER_EU.appId, REPO, 'site')],
    });
    const several = deriveAmplifyRow(ctx(client), byRepo()).problems.find(
      (p) => p.actions,
    );
    expect(several?.actions?.map((a) => a.label)).toEqual([
      `Pin site (us-east-1, ${MARKETING.appId})`,
      'Pin site (us-east-1, d1sitecopy)',
      'Pin site (eu-west-1)',
    ]);
    expect(several?.message).toContain(
      `site (us-east-1, ${MARKETING.appId}), site (us-east-1, d1sitecopy), site (eu-west-1)`,
    );
  });

  it('reads a pin for the key rather than what the search finds', () => {
    const client = new QueryClient();
    seedSearch(client, AWS, {
      'us-east-1': [listedApp(MARKETING.appId, REPO)],
    });
    const out = deriveAmplifyRow(
      ctx(client),
      byRepo({ pinnedApps: [{ ...PARTNER_EU, credentialId: AWS }] }),
    );
    expect(calls(out)).toContain(`branches:${PARTNER_EU.appId}`);
    expect(calls(out)).not.toContain(`branches:${MARKETING.appId}`);
    expect(out.problems).toEqual([]);
  });

  it('shows Error naming the region when a region fails', async () => {
    const client = new QueryClient();
    seedSearch(client, AWS);
    await seedSearchError(client, AWS, 'eu-west-1', new Error('boom'));
    const out = deriveAmplifyRow(ctx(client), byRepo());
    expect(out.cells[stageIds[0] ?? '']?.derivation).toMatchObject({
      state: EMPTY_STATES.error,
    });
    expect(out.problems.map((p) => p.message)).toEqual([
      expect.stringMatching(
        new RegExp(`the Amplify apps of the AWS key key ${AWS} in eu-west-1`),
      ),
    ]);
    // A pinned row doesn't need the search to read.
    const pinned = deriveAmplifyRow(ctx(client), rowOf('marketing-site'));
    expect(pinned.problems).toEqual([]);
  });

  it('needs a credential when a standard region rejects the key', async () => {
    const client = new QueryClient();
    seedSearch(client, AWS);
    await seedSearchError(
      client,
      AWS,
      'us-east-1',
      new AmplifyAuthError('bad key', 'ListApps'),
    );
    const out = deriveAmplifyRow(ctx(client), byRepo());
    expect(out.cells[stageIds[0] ?? '']?.derivation).toMatchObject({
      state: EMPTY_STATES.needsCredential,
    });
  });

  it("puts every cell on its key's account and app, reading each app once (the VC case)", () => {
    // A dashboard key and two column keys, one per AWS account; two rows
    // found by repo, no pins.
    const [a, b, c, ...rest] = measureBoard.stages;
    const dashboard: Dashboard = {
      ...measureBoard,
      settings: { ...measureBoard.settings, awsKey: AWS },
      credentials: [
        ...measureBoard.credentials,
        { id: 'k2', kind: 'aws', label: 'k2' },
        { id: 'k3', kind: 'aws', label: 'k3' },
      ],
      stages: [
        { ...a, settings: { awsKey: 'k2' } },
        { ...b, settings: { awsKey: 'k2' } },
        { ...c, settings: { awsKey: 'k3' } },
        ...rest,
      ],
    };
    const client = new QueryClient();
    const accounts = { [AWS]: 'prod', k2: 'dev', k3: 'release' };
    for (const [key, account] of Object.entries(accounts))
      seedSearch(client, key, {
        'us-east-1': [
          listedApp(`${account}-site`, REPO),
          listedApp(`${account}-shop`, 'acme/shop'),
        ],
      });
    const reads = (row: AmplifyRow) =>
      deriveAmplifyRow(ctx(client, true, dashboard), row).needs.flatMap(
        ({ key: [, credentialId, request] }) =>
          request.call === 'branches' && 'appId' in request
            ? [`${credentialId}/${request.appId}`]
            : [],
      );
    expect(reads(byRepo())).toEqual([
      'k2/dev-site',
      'k3/release-site',
      `${AWS}/prod-site`,
    ]);
    expect(reads(byRepo({ id: 'shop', repo: 'acme/shop' }))).toEqual([
      'k2/dev-shop',
      'k3/release-shop',
      `${AWS}/prod-shop`,
    ]);
  });

  it('needs nothing to search under a key with no secret', () => {
    const out = deriveAmplifyRow(ctx(new QueryClient(), false), byRepo());
    expect(calls(out)).toEqual([]);
  });
});
