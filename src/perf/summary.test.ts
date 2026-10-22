import { describe, expect, it } from 'vitest';

import type { RequestCall } from '@/query/instrument';

import {
  kindStats,
  median,
  type RequestRecord,
  rowRequests,
  SLOWEST_LISTED,
  summarise,
} from './summary';
import {
  DEMO_FIRST_CELL_MAX_MS,
  DEMO_FULL_BOARD_MAX_MS,
  DEMO_TARGET_LATENCY_MS,
  PERFORMANCE_TARGETS,
  REAL_COLD_FULL_BOARD_MAX_MS,
  RELOAD_FULL_BOARD_MAX_MS,
} from './targets';

const call = (kind: string, provider: 'github' | 'amplify' = 'github') =>
  ({ provider, kind, credentialId: 'c' }) satisfies RequestCall;

const req = (
  kind: string,
  start: number,
  end: number,
  rowIds: string[] = [],
  outcome = 'ok',
): RequestRecord => ({ call: call(kind), start, end, outcome, rowIds });

describe('median', () => {
  it('takes the middle value, or the mean of the middle two', () => {
    expect(median([])).toBe(0);
    expect(median([9, 1, 5])).toBe(5);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
});

describe('kindStats', () => {
  it('groups by provider and kind, counts failures, most time first', () => {
    const stats = kindStats([
      req('listRunJobs', 0, 100),
      req('listWorkflowRuns', 0, 900),
      req('listRunJobs', 0, 300, [], 'GitHubHttpError'),
      req('listRunJobs', 0, 200),
      { ...req('listJobs', 0, 50), call: call('listJobs', 'amplify') },
    ]);
    expect(stats.map((s) => [s.provider, s.kind])).toEqual([
      ['github', 'listWorkflowRuns'],
      ['github', 'listRunJobs'],
      ['amplify', 'listJobs'],
    ]);
    expect(stats[1]).toMatchObject({
      count: 3,
      failed: 1,
      medianMs: 200,
      maxMs: 300,
      totalMs: 600,
    });
  });
});

describe('rowRequests', () => {
  it('counts a shared read for every row that needed it, in board order', () => {
    const records = [req('runs', 0, 1, ['a', 'b']), req('jobs', 0, 1, ['b'])];
    expect(rowRequests(['b', 'a', 'c'], records)).toEqual([
      { rowId: 'b', requests: 2 },
      { rowId: 'a', requests: 1 },
      { rowId: 'c', requests: 0 },
    ]);
  });
});

const base = {
  board: 'Board',
  rowIds: ['a'],
  cells: 6,
  records: [] as RequestRecord[],
  strayRequests: 0,
};

const measured = (summary: ReturnType<typeof summarise>) =>
  summary.targets.filter((t) => t.actualMs !== undefined);

describe('summarise', () => {
  it('lists every Decision 30 target, judging the demo ones on a 300 ms demo', () => {
    const summary = summarise({
      ...base,
      kind: 'demo',
      demoLatencyMs: DEMO_TARGET_LATENCY_MS,
      pageLoad: 'navigate',
      firstCell: { sinceOpen: 1_200, sinceLoad: 1_900 },
      fullBoard: { sinceOpen: 9_000, sinceLoad: 9_700 },
    });
    // Every target is listed, judged or not (here the reload and real
    // board ones aren't).
    expect(summary.targets).toHaveLength(PERFORMANCE_TARGETS.length);
    expect(summary.targets.filter((t) => t.met === undefined)).toHaveLength(
      PERFORMANCE_TARGETS.length - 2,
    );
    expect(measured(summary)).toEqual([
      expect.objectContaining({
        maxMs: DEMO_FIRST_CELL_MAX_MS,
        actualMs: 1_200,
        met: true,
      }),
      expect.objectContaining({
        maxMs: DEMO_FULL_BOARD_MAX_MS,
        actualMs: 9_000,
        met: false,
      }),
    ]);
  });

  it('judges no demo target at another latency, and says why', () => {
    const summary = summarise({
      ...base,
      kind: 'demo',
      demoLatencyMs: 0,
      fullBoard: { sinceOpen: 50 },
    });
    expect(measured(summary)).toEqual([]);
    expect(summary.notes.some((n) => n.includes('assume 300 ms'))).toBe(true);
  });

  it('judges a real board from opening, and a reload from the page load', () => {
    const cold = summarise({
      ...base,
      kind: 'real',
      demoLatencyMs: 0,
      pageLoad: 'navigate',
      fullBoard: { sinceOpen: 9_000, sinceLoad: 9_800 },
    });
    expect(measured(cold)).toEqual([
      expect.objectContaining({
        maxMs: REAL_COLD_FULL_BOARD_MAX_MS,
        actualMs: 9_000,
        met: true,
      }),
    ]);
    const reload = summarise({
      ...base,
      kind: 'real',
      demoLatencyMs: 0,
      pageLoad: 'reload',
      fullBoard: { sinceOpen: 9_000, sinceLoad: 9_800 },
    });
    expect(measured(reload)).toEqual([
      expect.objectContaining({
        maxMs: RELOAD_FULL_BOARD_MAX_MS,
        actualMs: 9_800,
        met: false,
      }),
    ]);
  });

  it('counts requests and failures, lists the slowest, and notes stray requests', () => {
    const records = Array.from({ length: SLOWEST_LISTED + 2 }, (_, i) =>
      req('jobs', 0, (i + 1) * 10, ['a'], i === 0 ? 'GitHubHttpError' : 'ok'),
    );
    const summary = summarise({
      ...base,
      kind: 'real',
      demoLatencyMs: 0,
      records,
      strayRequests: 12,
    });
    expect(summary.requests.total).toBe(records.length);
    expect(summary.requests.failed).toBe(1);
    expect(summary.slowest).toHaveLength(SLOWEST_LISTED);
    expect(summary.slowest[0]?.ms).toBe(records.length * 10);
    expect(summary.perRow).toEqual([{ rowId: 'a', requests: records.length }]);
    expect(summary.notes.some((n) => n.startsWith('12 requests'))).toBe(true);
  });
});
