/**
 * Tests for the share envelope (spec.md §3.8 *Share format*): a round
 * trip; the format tag checked first; newer envelope or data model
 * versions refused; older data models (v4, v5) migrated to v7; malformed
 * envelopes, dashboards and credentials refused rather than defaulted;
 * repeated ids refused.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import v4Board from '@/domain/config/fixtures/v4-board.json';
import v5Board from '@/domain/config/fixtures/v5-board.json';
import { migrate } from '@/domain/config/migrate';
import { CURRENT_SCHEMA_VERSION } from '@/domain/config/root';
import { shareBoard } from '@/test/shareBoard';

import {
  buildEnvelope,
  readShare,
  SHARE_FORMAT,
  SHARE_FORMAT_VERSION,
} from './envelope';
import { planImport } from './importPlan';
import { encryptSecrets } from './secrets';

const board = shareBoard();
const envelope = (): Record<string, unknown> => ({
  ...buildEnvelope([board], null),
});
const read = (value: unknown) => readShare(JSON.stringify(value));
const refused = (reason: string) => ({ ok: false, reason });

describe('the share envelope', () => {
  it('writes the approved shape and reads it back unchanged', () => {
    expect(envelope()).toEqual({
      format: 'fooboard-share',
      formatVersion: 1,
      // Every share 0.2.0 makes carries v7 (spec 0.2.0 §3.I).
      schemaVersion: 7,
      dashboards: [board],
      credentials: null,
    });
    expect(read(envelope())).toEqual({
      ok: true,
      share: { dashboards: [board], credentials: { kind: 'none' } },
    });
  });

  it.each([
    ['another format', { ...envelope(), format: 'fooboard' }],
    ['no format', { ...envelope(), format: undefined }],
    ['a bare array of dashboards', [board]],
    ['a configuration root', { schemaVersion: 6, dashboards: [board] }],
    ['a string', 'fooboard-share'],
    ['null', null],
  ])('says %s is not a share', (_, value) => {
    expect(read(value)).toEqual(refused('notShare'));
  });

  it('checks the format before anything else', () => {
    expect(read({ format: 'x', formatVersion: 99, schemaVersion: 99 })).toEqual(
      refused('notShare'),
    );
  });

  it.each([
    ['envelope', { formatVersion: SHARE_FORMAT_VERSION + 1 }],
    ['data model', { schemaVersion: CURRENT_SCHEMA_VERSION + 1 }],
  ])('refuses a newer %s version, however the rest looks', (_, change) => {
    expect(read({ ...envelope(), ...change })).toEqual(refused('newer'));
    expect(read({ format: SHARE_FORMAT, ...change })).toEqual(refused('newer'));
  });

  it.each([
    ['v4', v4Board],
    ['v5', v5Board],
  ])('migrates %s dashboards through the chain to v7', (_, root) => {
    const result = read({
      ...envelope(),
      schemaVersion: root.schemaVersion,
      dashboards: root.dashboards,
    });
    expect(result).toEqual({
      ok: true,
      share: {
        dashboards: migrate(structuredClone(root)).dashboards,
        credentials: { kind: 'none' },
      },
    });
  });

  it.each([
    ['not JSON', null],
    ['an early data model', { schemaVersion: 3 }],
    ['no data model version', { schemaVersion: undefined }],
    ['a fractional envelope version', { formatVersion: 1.5 }],
    ['envelope version 0', { formatVersion: 0 }],
    ['a string envelope version', { formatVersion: '1' }],
    ['no dashboards', { dashboards: [] }],
    ['dashboards not a list', { dashboards: { a: board } }],
    ['an invalid dashboard', { dashboards: [{ ...board, rows: 'x' }] }],
    ['no credentials field', { credentials: undefined }],
    ['credentials without a kind', { credentials: { secrets: {} } }],
    [
      'a plain secret missing its token',
      {
        credentials: { encrypted: false, secrets: { a: { kind: 'github' } } },
      },
    ],
    ['repeated dashboard ids', { dashboards: [board, board] }],
    [
      'a credential id in two dashboards',
      { dashboards: [board, { ...board, id: 'other' }] },
    ],
  ])('refuses %s as damaged', (name, change) => {
    const text =
      change === null
        ? '{"format":'
        : JSON.stringify({ ...envelope(), ...change });
    expect({ name, read: readShare(text) }).toEqual({
      name,
      read: refused('damaged'),
    });
  });

  it('carries plain secrets beside the dashboards', () => {
    const secrets = { 'gh-org': { kind: 'github' as const, token: 't' } };
    expect(
      read(buildEnvelope([board], { encrypted: false, secrets })),
    ).toMatchObject({
      ok: true,
      share: { credentials: { kind: 'plain', secrets } },
    });
  });

  it('reads a "__proto__" secret key without polluting, and stores nothing for it', () => {
    const gh = { kind: 'github', token: 'shared' };
    const text = JSON.stringify({ ...envelope(), credentials: null }).replace(
      '"credentials":null',
      `"credentials":{"encrypted":false,"secrets":{"__proto__":${JSON.stringify(gh)},"gh-org":${JSON.stringify(gh)}}}`,
    );
    const result = readShare(text);
    if (!result.ok || result.share.credentials.kind !== 'plain')
      throw new Error('expected plain credentials');
    expect(Object.getPrototypeOf({})).toBe(Object.prototype);
    expect(Reflect.get({}, 'token')).toBeUndefined();
    const plan = planImport([], {
      dashboards: result.share.dashboards,
      mode: 'add',
      sameId: {},
      secrets: result.share.credentials.secrets,
    });
    expect(plan.secrets).toEqual([
      { id: 'gh-org', label: 'Northwind org', secret: gh },
    ]);
  });

  it('carries encrypted secrets, refusing an unknown cipher', async () => {
    const block = await encryptSecrets({}, 'p', 1_000);
    expect(read(buildEnvelope([board], block))).toMatchObject({
      ok: true,
      share: { credentials: { kind: 'encrypted', block } },
    });
    expect(
      read({ ...envelope(), credentials: { ...block, cipher: 'AES-CBC' } }),
    ).toEqual(refused('damaged'));
  });
});
