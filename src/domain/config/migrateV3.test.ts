/**
 * Tests for the v2 to v3 migration (spec.md A§4.3.6): defaults move to the
 * bundled presets; edited phase tests or colours become the dashboard's
 * own sets, classifying and colouring runs as before; phase tests and
 * status colours are gone afterwards.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { classify } from '@/domain/statuses/classify';
import { githubRunDocument } from '@/domain/statuses/documents';
import { statusSetFor } from '@/domain/statuses/resolve';

import { migrate } from './migrate';

const v2 = (dashboard: object) =>
  migrate({
    schemaVersion: 2,
    dashboards: [{ id: 'd', name: 'D', ...dashboard }],
  }).dashboards[0];

const row = {
  type: 'github',
  id: 'web',
  repo: 'acme/web',
  displayName: 'web',
};

const run = {
  id: 1,
  workflowName: 'CI',
  headBranch: 'main',
  headSha: 'abc',
  createdAt: '2026-10-01T00:00:00Z',
  event: 'push',
  htmlUrl: '',
};
const job = (name: string) => ({
  id: 1,
  runId: 1,
  runAttempt: 1,
  name,
  status: 'completed' as const,
  conclusion: 'success' as const,
  startedAt: null,
  completedAt: null,
  htmlUrl: '',
});

describe('migrate v2 to v3', () => {
  it('puts a dashboard on the defaults onto the presets', () => {
    const d = v2({ rows: [row] });
    expect(d.statusSets).toEqual({
      github: 'github-deploy-test',
      amplify: 'amplify',
    });
    expect(d.customStatusSets).toEqual([]);
  });

  it("gives edited phase tests the dashboard's own GitHub set", () => {
    const d = v2({
      rows: [row],
      mapping: {
        phases: {
          deploy: [{ field: 'jobName', operator: 'is', value: 'ship' }],
          test: [{ field: 'jobName', operator: 'contains', value: 'e2e' }],
        },
      },
    });
    expect(d.statusSets).toEqual({
      github: 'custom-github',
      amplify: 'amplify',
    });
    const set = statusSetFor(d, d.rows[0], 'prod');
    expect(set.id).toBe('custom-github');
    const status = (name: string) => {
      const doc = githubRunDocument({ run, jobs: [job(name)] }, [], set.jobs);
      return doc && classify(doc, set)?.id;
    };
    expect(status('Ship')).toBe('deployed');
    expect(status('deploy')).toBeUndefined();
    expect(status('smoke e2e')).toBe('passed');
  });

  it('keeps edited colours, on both providers', () => {
    const d = v2({ statusColors: { failure: '#ff0000' } });
    const [github, amplify] = d.customStatusSets;
    expect(d.statusSets).toEqual({
      github: 'custom-github',
      amplify: 'custom-amplify',
    });
    for (const set of [github, amplify]) {
      expect(
        set.cell.filter((c) => c.color === '#ff0000').length,
      ).toBeGreaterThan(0);
      expect(set.summary.find((s) => s.id === 'failing')?.color).toBe(
        '#ff0000',
      );
      expect(set.cell.find((c) => c.id === 'queued')?.color).toBe('#e2e8f0');
    }
  });
});
