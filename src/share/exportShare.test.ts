/**
 * Tests for building a share (spec.md §3.8): no secrets unless included;
 * included secrets only for the credentials the chosen dashboards
 * reference, plain or encrypted; nothing from device preferences; the
 * file name.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import type { Dashboard } from '@/domain/config/dashboard';
import type { CredentialSecret } from '@/storage/credentialStore';
import { shareBoard } from '@/test/shareBoard';

import { readShare } from './envelope';
import { makeShare, secretsOf, shareFileName } from './exportShare';
import { decryptSecrets } from './secrets';

const gh = { kind: 'github', token: 'ghp_secret' } as const;
const aws = {
  kind: 'aws',
  accessKeyId: 'AKIA',
  secretAccessKey: 'aws_secret',
} as const;
const device: Record<string, CredentialSecret> = {
  'gh-org': gh,
  'aws-dev': aws,
  'aws-stage': gh, // the wrong kind: never exported
  unrelated: gh,
};
const get = (id: string) => device[id];
const board = shareBoard();

describe('makeShare', () => {
  it('carries no secrets unless they are included', async () => {
    const share = await makeShare([board], { include: false }, get);
    expect(share.credentials).toBeNull();
    expect(JSON.stringify(share)).not.toMatch(/ghp_secret|aws_secret/);
    expect(readShare(JSON.stringify(share))).toMatchObject({ ok: true });
  });

  it('includes plain secrets only for referenced credentials', async () => {
    const share = await makeShare(
      [board],
      { include: true, passphrase: null },
      get,
    );
    expect(share.credentials).toEqual({
      encrypted: false,
      secrets: { 'gh-org': gh, 'aws-dev': aws },
    });
  });

  it('encrypts included secrets under a passphrase', async () => {
    const share = await makeShare(
      [board],
      { include: true, passphrase: 'open sesame' },
      get,
      1_000,
    );
    expect(JSON.stringify(share)).not.toMatch(/ghp_secret|aws_secret/);
    const read = readShare(JSON.stringify(share));
    if (!read.ok || read.share.credentials.kind !== 'encrypted')
      throw new Error('expected encrypted credentials');
    expect(
      await decryptSecrets(read.share.credentials.block, 'open sesame'),
    ).toEqual({ ok: true, secrets: { 'gh-org': gh, 'aws-dev': aws } });
  });

  it('collects secrets across the chosen dashboards only', () => {
    const second: Dashboard = {
      ...board,
      id: 'two',
      credentials: [{ id: 'unrelated', kind: 'github', label: 'x' }],
    };
    expect(Object.keys(secretsOf([board], get))).toEqual(['gh-org', 'aws-dev']);
    expect(Object.keys(secretsOf([board, second], get))).toEqual([
      'gh-org',
      'aws-dev',
      'unrelated',
    ]);
  });
});

describe('shareFileName', () => {
  it.each([
    [[board], 'fooboard-northwind-deploys.json'],
    [[{ ...board, name: '  Ops / Prod!! ' }], 'fooboard-ops-prod.json'],
    [[{ ...board, name: '***' }], 'fooboard-1-dashboards.json'],
    [[board, board], 'fooboard-2-dashboards.json'],
  ])('names a share of %#', (dashboards, name) => {
    expect(shareFileName(dashboards)).toBe(name);
  });
});
