/**
 * Tests for candidate-run selection (spec.md §4.3.2 step 1): excluded
 * events, the workflow filter and branch pattern narrowing, newest-first
 * ordering.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import {
  isCandidateRun,
  passesWorkflowFilter,
  selectCandidateRuns,
} from './candidateRuns';
import { defaultMapping, makeRunWithJobs } from './testFixtures';

describe('passesWorkflowFilter', () => {
  it('includes all workflows when include is empty', () => {
    expect(passesWorkflowFilter('CI', defaultMapping)).toBe(true);
  });

  it('excludes a workflow matching an exclude test', () => {
    const mapping = {
      ...defaultMapping,
      workflowFilter: {
        include: [],
        exclude: [
          {
            field: 'workflowName' as const,
            operator: 'is' as const,
            value: 'Nightly',
          },
        ],
      },
    };
    expect(passesWorkflowFilter('Nightly', mapping)).toBe(false);
    expect(passesWorkflowFilter('CI', mapping)).toBe(true);
  });

  it('only includes workflows matching an include test when set', () => {
    const mapping = {
      ...defaultMapping,
      workflowFilter: {
        include: [
          {
            field: 'workflowName' as const,
            operator: 'is' as const,
            value: 'CI',
          },
        ],
        exclude: [],
      },
    };
    expect(passesWorkflowFilter('CI', mapping)).toBe(true);
    expect(passesWorkflowFilter('Other', mapping)).toBe(false);
  });
});

describe('isCandidateRun', () => {
  it('excludes pull_request and pull_request_target events', () => {
    const pr = makeRunWithJobs(
      { event: 'pull_request', headBranch: 'main' },
      [],
    );
    const prTarget = makeRunWithJobs(
      { event: 'pull_request_target', headBranch: 'main' },
      [],
    );
    expect(isCandidateRun(pr, defaultMapping, 'main')).toBe(false);
    expect(isCandidateRun(prTarget, defaultMapping, 'main')).toBe(false);
  });

  it('excludes a run with no head branch (e.g. a deleted branch)', () => {
    const entry = makeRunWithJobs({ headBranch: null }, []);
    expect(isCandidateRun(entry, defaultMapping, 'main')).toBe(false);
  });

  it('includes a push run whose branch matches the stage pattern', () => {
    const entry = makeRunWithJobs(
      { event: 'push', headBranch: 'release/24.3' },
      [],
    );
    expect(isCandidateRun(entry, defaultMapping, 'release/**')).toBe(true);
    expect(isCandidateRun(entry, defaultMapping, 'main')).toBe(false);
  });
});

describe('selectCandidateRuns', () => {
  it('returns matching runs newest first by createdAt', () => {
    const older = makeRunWithJobs(
      { headBranch: 'main', createdAt: '2026-10-01T00:00:00Z' },
      [],
    );
    const newer = makeRunWithJobs(
      { headBranch: 'main', createdAt: '2026-10-05T00:00:00Z' },
      [],
    );
    const offBranch = makeRunWithJobs({ headBranch: 'dev' }, []);
    const result = selectCandidateRuns(
      [older, offBranch, newer],
      defaultMapping,
      'main',
    );
    expect(result).toEqual([newer, older]);
  });
});
