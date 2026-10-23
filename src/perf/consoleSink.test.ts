import { describe, expect, it } from 'vitest';

import { headline, summaryTables } from './consoleSink';
import { summarise } from './summary';
import { DEMO_TARGET_LATENCY_MS } from './targets';

const summary = (pageLoad?: string) =>
  summarise({
    board: 'Acme',
    kind: 'demo',
    demoLatencyMs: DEMO_TARGET_LATENCY_MS,
    rowIds: ['api', 'web'],
    cells: 12,
    ...(pageLoad ? { pageLoad } : {}),
    firstCell: { sinceOpen: 912.4, sinceLoad: 1_400 },
    fullBoard: { sinceOpen: 9_000.6, sinceLoad: 9_500 },
    records: [
      {
        call: { provider: 'github', kind: 'compare', credentialId: 'c' },
        start: 0,
        end: 320,
        outcome: 'ok',
        rowIds: ['api'],
      },
    ],
    strayRequests: 0,
  });

describe('headline', () => {
  it('gives the measures from opening, and from the page load when known', () => {
    expect(headline(summary())).toBe(
      'fooboard-timing Acme (demo, 12 cells, 1 requests): from opening: first cell 912 ms, full board 9001 ms',
    );
    expect(headline(summary('reload'))).toContain(
      '; from page reload: first cell 1400 ms, full board 9500 ms',
    );
  });
});

describe('summaryTables', () => {
  it('marks missed targets, unjudged ones, and names rows', () => {
    const tables = summaryTables(summary(), { api: 'API' });
    expect(tables.targets.map((t) => [t.measured, t.met])).toEqual([
      ['912 ms', 'yes'],
      ['9001 ms', 'NO'],
      ['—', 'n/a'],
      ['—', 'n/a'],
    ]);
    expect(tables['requests per row']).toEqual([
      { row: 'API', requests: 1 },
      { row: 'web', requests: 0 },
    ]);
    expect(tables['requests by kind'][0]).toMatchObject({
      request: 'github compare',
      count: 1,
      median: '320 ms',
    });
    expect(tables.slowest).toEqual([
      { request: 'github compare', time: '320 ms', outcome: 'ok' },
    ]);
  });
});
