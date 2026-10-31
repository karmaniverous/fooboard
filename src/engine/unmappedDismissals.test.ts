/**
 * Tests for matching dismissals to unmapped entries and the *Dismiss…*
 * presets (spec 0.2.0 §3.I, Decisions 86 and 101): each field matches as
 * specified (repo and workflow case-insensitively, a branch by pattern,
 * the reason on every row), a pattern matches only when all its fields
 * do, and the presets follow their guards.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import type { UnmappedDismissal } from '@/domain/config/unmappedDismissals';
import { UNMAPPED, type UnmappedReason } from '@/domain/derivation/unmapped';

import type { UnmappedRun } from './types';
import {
  branchesLike,
  matchesDismissal,
  presetsFor,
  splitUnmapped,
} from './unmappedDismissals';

const noStage: UnmappedReason = { kind: UNMAPPED.noStageMatches };
const noRow: UnmappedReason = { kind: UNMAPPED.noRowMatches };

/** A GitHub entry read by one row, unless changed. */
const run = (over: Partial<UnmappedRun> = {}): UnmappedRun => ({
  provider: 'github',
  id: 'acme/api#1',
  where: 'acme/api',
  title: 'Deploy',
  branch: 'feature/login',
  htmlUrl: 'https://github.com/acme/api/actions/runs/1',
  record: {},
  reason: noStage,
  rows: [{ rowId: 'api', reason: noStage }],
  ...over,
});
const amplifyJob = run({
  provider: 'amplify',
  where: 'd1app',
  title: 'Deploy',
});

describe('matchesDismissal', () => {
  it('compares the repo or app and the workflow case-insensitively', () => {
    expect(matchesDismissal({ where: 'ACME/Api' }, run())).toBe(true);
    expect(matchesDismissal({ where: 'acme/web' }, run())).toBe(false);
    expect(matchesDismissal({ workflow: 'deploy' }, run())).toBe(true);
    expect(matchesDismissal({ workflow: 'Nightly' }, run())).toBe(false);
  });

  it('never matches an Amplify job by workflow', () => {
    expect(matchesDismissal({ workflow: 'Deploy' }, amplifyJob)).toBe(false);
    expect(matchesDismissal({ where: 'D1APP' }, amplifyJob)).toBe(true);
  });

  it('matches a branch by pattern, `*` within a segment, `**` across them', () => {
    const deep = run({ branch: 'feature/login/oauth' });
    expect(matchesDismissal({ branch: 'feature/*' }, run())).toBe(true);
    expect(matchesDismissal({ branch: 'feature/*' }, deep)).toBe(false);
    expect(matchesDismissal({ branch: 'feature/**' }, deep)).toBe(true);
    expect(matchesDismissal({ branch: 'Feature/*' }, run())).toBe(false);
  });

  it('never matches an entry without a branch by branch', () => {
    expect(matchesDismissal({ branch: '**' }, run({ branch: null }))).toBe(
      false,
    );
  });

  it('matches a reason only when every row reading the entry gives it', () => {
    const both = run({
      rows: [
        { rowId: 'api', reason: noStage },
        { rowId: 'api-2', reason: noRow },
      ],
    });
    expect(matchesDismissal({ reason: 'no-stage-matches' }, run())).toBe(true);
    expect(matchesDismissal({ reason: 'no-stage-matches' }, both)).toBe(false);
    expect(matchesDismissal({ reason: 'no-row-matches' }, run())).toBe(false);
  });

  it('matches only when every field it sets does', () => {
    expect(matchesDismissal({ where: 'acme/api', branch: 'main' }, run())).toBe(
      false,
    );
    expect(
      matchesDismissal({ where: 'acme/api', branch: 'feature/*' }, run()),
    ).toBe(true);
  });
});

describe('splitUnmapped', () => {
  it('splits entries into shown and dismissed, naming the dismissal', () => {
    const other = run({ id: 'acme/web#2', where: 'acme/web' });
    const by: UnmappedDismissal = { id: 'd1', where: 'acme/api' };
    expect(splitUnmapped([run(), other], [by])).toEqual({
      shown: [other],
      dismissed: [{ run: run(), by }],
    });
    expect(splitUnmapped([run(), other], [])).toEqual({
      shown: [run(), other],
      dismissed: [],
    });
  });
});

describe('presetsFor', () => {
  it('offers the workflow, both branch presets and the reason for a GitHub entry', () => {
    expect(presetsFor(run())).toEqual([
      {
        id: 'workflow',
        label: 'This workflow on any branch',
        pattern: { where: 'acme/api', workflow: 'Deploy' },
      },
      {
        id: 'branchHere',
        label: 'This branch here',
        pattern: { where: 'acme/api', branch: 'feature/login' },
      },
      {
        id: 'branchesLike',
        label: 'Branches like this anywhere',
        pattern: { branch: 'feature/*' },
      },
      {
        id: 'reason',
        label: 'Everything with this reason',
        pattern: { reason: 'no-stage-matches' },
      },
    ]);
  });

  it('hides Branches like this for a one-segment branch', () => {
    const ids = presetsFor(run({ branch: 'main' })).map((p) => p.id);
    expect(ids).toEqual(['workflow', 'branchHere', 'reason']);
  });

  it('offers no branch preset without a branch, no workflow for Amplify', () => {
    expect(presetsFor(run({ branch: null })).map((p) => p.id)).toEqual([
      'workflow',
      'reason',
    ]);
    expect(presetsFor(amplifyJob).map((p) => p.id)).not.toContain('workflow');
  });

  it('offers the reason only when every row gives the same one', () => {
    const mixed = run({
      rows: [
        { rowId: 'api', reason: noStage },
        { rowId: 'api-2', reason: noRow },
      ],
    });
    expect(presetsFor(mixed).map((p) => p.id)).not.toContain('reason');
  });

  it('never offers an exact-run preset', () => {
    for (const preset of presetsFor(run()))
      expect(Object.keys(preset.pattern)).not.toContain('id');
    expect(presetsFor(run())).toHaveLength(4);
  });

  it('replaces only the last segment for Branches like this', () => {
    expect(branchesLike('release/1.2/fix')).toBe('release/1.2/*');
    expect(branchesLike('main')).toBeUndefined();
  });
});
