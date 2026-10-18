/**
 * Tests for unmapped-run classification (spec.md C-15): the three reason
 * buckets, a mapped run returning `undefined`, `pull_request` runs never
 * appearing as unmapped, and per-row branch patterns (C-14c).
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import {
  defaultMapping,
  githubSet,
  makeJob,
  makeRunWithJobs,
} from './testFixtures';
import { classifyUnmappedRun, describeUnmappedReason } from './unmapped';

const patterns = ['main', 'release/**'];
const jobTest = githubSet.jobs;
const keyless = { rowKeyTests: [], branchPatterns: patterns, jobTest };
const keyed = (value: string) => ({
  branchPatterns: patterns,
  jobTest,
  rowKeyTests: [
    { field: 'jobName' as const, operator: 'contains' as const, value },
  ],
});
const run = (headBranch: string, job: string, event = 'push') =>
  makeRunWithJobs({ event, headBranch }, [makeJob({ name: job })]);

describe('classifyUnmappedRun', () => {
  it.each([
    [
      'never unmapped: pull_request',
      run('feature/x', 'deploy', 'pull_request'),
      [keyless],
      undefined,
    ],
    [
      'no-stage-matches-branch',
      run('feature/x', 'deploy'),
      [keyless],
      { kind: 'no-stage-matches-branch', branch: 'feature/x' },
    ],
    [
      'no-relevant-job',
      run('main', 'lint'),
      [keyless],
      { kind: 'no-relevant-job' },
    ],
    ['mapped by a key-less row', run('main', 'deploy'), [keyless], undefined],
    [
      'no-row-key-matches',
      run('main', 'deploy (billing)'),
      [keyed('invoicing')],
      { kind: 'no-row-key-matches' },
    ],
    [
      'mapped by a keyed row',
      run('main', 'deploy (billing)'),
      [keyed('billing')],
      undefined,
    ],
  ])('%s', (_label, entry, rows, expected) => {
    expect(classifyUnmappedRun(entry, rows, defaultMapping)).toEqual(expected);
  });

  it('lets only rows whose effective patterns take the branch place it (C-14c)', () => {
    const entry = run('preview/release', 'deploy');
    // The override is on the keyed row whose key doesn't match: unmapped.
    const overridden = { ...keyed('web'), branchPatterns: ['preview/release'] };
    const api = { ...keyless, branchPatterns: ['release/**'] };
    expect(classifyUnmappedRun(entry, [api], defaultMapping)).toEqual({
      kind: 'no-stage-matches-branch',
      branch: 'preview/release',
    });
    expect(
      classifyUnmappedRun(entry, [api, overridden], defaultMapping),
    ).toEqual({ kind: 'no-row-key-matches' });
    expect(
      classifyUnmappedRun(
        entry,
        [api, { ...overridden, rowKeyTests: [] }],
        defaultMapping,
      ),
    ).toBeUndefined();
  });

  it("uses each row's status set: a run its set covers is placed", () => {
    const anyJob = { ...keyless, jobTest: {} };
    expect(
      classifyUnmappedRun(run('main', 'lint'), [anyJob], defaultMapping),
    ).toBeUndefined();
  });
});

describe('describeUnmappedReason', () => {
  it('renders each reason as the C-15 message text', () => {
    expect(
      describeUnmappedReason({
        kind: 'no-stage-matches-branch',
        branch: 'feature/x',
      }),
    ).toBe('no stage matches branch "feature/x"');
    expect(describeUnmappedReason({ kind: 'no-relevant-job' })).toBe(
      'no job its status set covers',
    );
    expect(describeUnmappedReason({ kind: 'no-row-key-matches' })).toBe(
      'no row key matches',
    );
  });
});
