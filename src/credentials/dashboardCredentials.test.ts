/**
 * Tests for dashboard credential changes: the first credential of a kind
 * becomes the dashboard's setting, *Make default* sets it, and removing
 * one clears it at every level and drops the pins keyed by it (keeping,
 * unkeyed, the last pin of a row without a repo), leaving a valid
 * dashboard with no dangling references.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { DashboardSchema } from '@/domain/config/dashboard';
import type { Row } from '@/domain/config/row';

import {
  addCredential,
  mapCredentialRefs,
  removeCredential,
  setDefaultCredential,
} from './dashboardCredentials';

const base = DashboardSchema.parse({
  id: 'd',
  name: 'D',
  stages: [{ id: 'dev', name: 'dev' }],
});
const gh = (id: string) => ({ id, kind: 'github' as const, label: id });
const aws = (id: string) => ({ id, kind: 'aws' as const, label: id });

/** A board naming credentials `a` (GitHub) and `k`, `j` (AWS) at every
 * level and on pins. */
function referencing() {
  let d = addCredential(base, gh('a'));
  d = addCredential(d, aws('k'));
  d = addCredential(d, aws('j'));
  const rows: Row[] = [
    {
      type: 'github',
      id: 'r1',
      repo: 'o/r',
      displayName: 'r',
      stageRules: {},
      settings: { githubToken: 'a' },
      cellSettings: { dev: { githubToken: 'a' } },
    },
    {
      type: 'amplify',
      id: 'r2',
      repo: 'o/s',
      displayName: 's',
      pinnedApps: [
        { credentialId: 'k', region: 'us-east-1', appId: 'x' },
        { credentialId: 'j', region: 'us-east-1', appId: 'y' },
      ],
      stageRules: {},
      settings: { githubToken: 'a', awsKey: 'k' },
      cellSettings: {},
    },
    {
      type: 'amplify',
      id: 'r3',
      displayName: 'bare',
      pinnedApps: [{ credentialId: 'k', region: 'us-east-1', appId: 'z' }],
      stageRules: {},
      settings: {},
      cellSettings: {},
    },
  ];
  return {
    ...d,
    rows,
    stages: d.stages.map((s) => ({ ...s, settings: { awsKey: 'k' } })),
    rowGroups: [
      {
        id: 'g',
        memberIds: ['r1'],
        settings: { githubToken: 'a' },
        stageRules: {},
        rowRules: {},
      },
    ],
    columnGroups: [
      {
        id: 'c',
        memberIds: ['dev'],
        settings: { awsKey: 'k' },
        stageRules: {},
      },
    ],
  };
}

describe('dashboard credentials', () => {
  it("makes the first credential of a kind the dashboard's setting", () => {
    const one = addCredential(base, gh('a'));
    const two = addCredential(one, gh('b'));
    expect(two.settings.githubToken).toBe('a');
    expect(addCredential(two, aws('k')).settings.awsKey).toBe('k');
    expect(setDefaultCredential(two, 'github', 'b').settings).toEqual({
      ...two.settings,
      githubToken: 'b',
    });
  });

  it('removes a credential and every reference to it, at every level', () => {
    const d = referencing();
    expect(() => DashboardSchema.parse(d)).not.toThrow();
    const removed = removeCredential(removeCredential(d, 'a'), 'k');
    expect(() => DashboardSchema.parse(removed)).not.toThrow();
    expect(removed.credentials.map((c) => c.id)).toEqual(['j']);
    expect(JSON.stringify(removed)).not.toMatch(/"(a|k)"/);
  });

  it('drops the pins keyed by a removed key, keeping a bare row its last pin unkeyed', () => {
    const removed = removeCredential(referencing(), 'k');
    const pins = (id: string) =>
      removed.rows.flatMap((r) =>
        r.id === id && r.type === 'amplify' ? r.pinnedApps : [],
      );
    expect(pins('r2')).toEqual([
      { credentialId: 'j', region: 'us-east-1', appId: 'y' },
    ]);
    expect(pins('r3')).toEqual([{ region: 'us-east-1', appId: 'z' }]);
  });

  it('re-ids every reference, settings and pins alike', () => {
    const mapped = mapCredentialRefs(referencing(), (id) => `${id}2`);
    // The list itself is the caller's to re-id.
    expect(JSON.stringify({ ...mapped, credentials: [] })).not.toMatch(
      /"(a|k|j)"/,
    );
    expect(mapped.rows[1]).toMatchObject({
      settings: { githubToken: 'a2', awsKey: 'k2' },
      pinnedApps: [{ credentialId: 'k2' }, { credentialId: 'j2' }],
    });
  });
});
