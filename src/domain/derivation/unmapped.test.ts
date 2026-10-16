/**
 * Tests for unmapped-run classification (spec.md C-15): the three reason
 * buckets, a mapped run returning `undefined`, and `pull_request` runs
 * never appearing as unmapped.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { defaultMapping, makeJob, makeRunWithJobs } from './testFixtures';
import { classifyUnmappedRun, describeUnmappedReason } from './unmapped';

const stages = [{ branchPattern: 'main' }, { branchPattern: 'release/**' }];

describe('classifyUnmappedRun', () => {
  it('is undefined (never unmapped) for pull_request events', () => {
    const entry = makeRunWithJobs(
      { event: 'pull_request', headBranch: 'feature/x' },
      [],
    );
    expect(
      classifyUnmappedRun(entry, stages, [], defaultMapping),
    ).toBeUndefined();
  });

  it('reports no-stage-matches-branch when no stage pattern matches', () => {
    const entry = makeRunWithJobs({ event: 'push', headBranch: 'feature/x' }, [
      makeJob({ name: 'deploy' }),
    ]);
    expect(classifyUnmappedRun(entry, stages, [], defaultMapping)).toEqual({
      kind: 'no-stage-matches-branch',
      branch: 'feature/x',
    });
  });

  it('reports no-phase-matches-job when the branch matches but no job matches a phase', () => {
    const entry = makeRunWithJobs({ event: 'push', headBranch: 'main' }, [
      makeJob({ name: 'lint' }),
    ]);
    expect(classifyUnmappedRun(entry, stages, [], defaultMapping)).toEqual({
      kind: 'no-phase-matches-job',
    });
  });

  it('is mapped (undefined) when a key-less row would see the phase-matching job', () => {
    const entry = makeRunWithJobs({ event: 'push', headBranch: 'main' }, [
      makeJob({ name: 'deploy' }),
    ]);
    const rows = [{ rowKeyTests: [] }];
    expect(
      classifyUnmappedRun(entry, stages, rows, defaultMapping),
    ).toBeUndefined();
  });

  it('reports no-row-key-matches when only keyed rows exist and none match', () => {
    const entry = makeRunWithJobs({ event: 'push', headBranch: 'main' }, [
      makeJob({ name: 'deploy (billing)' }),
    ]);
    const rows = [
      {
        rowKeyTests: [
          {
            field: 'jobName' as const,
            operator: 'contains' as const,
            value: 'invoicing',
          },
        ],
      },
    ];
    expect(classifyUnmappedRun(entry, stages, rows, defaultMapping)).toEqual({
      kind: 'no-row-key-matches',
    });
  });

  it("is mapped (undefined) when a keyed row's test matches the job", () => {
    const entry = makeRunWithJobs({ event: 'push', headBranch: 'main' }, [
      makeJob({ name: 'deploy (billing)' }),
    ]);
    const rows = [
      {
        rowKeyTests: [
          {
            field: 'jobName' as const,
            operator: 'contains' as const,
            value: 'billing',
          },
        ],
      },
    ];
    expect(
      classifyUnmappedRun(entry, stages, rows, defaultMapping),
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
    expect(describeUnmappedReason({ kind: 'no-phase-matches-job' })).toBe(
      'no phase matches any job',
    );
    expect(describeUnmappedReason({ kind: 'no-row-key-matches' })).toBe(
      'no row key matches',
    );
  });
});
