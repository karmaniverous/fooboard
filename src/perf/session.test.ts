import { describe, expect, it } from 'vitest';

import { demoDashboard } from '@/demo/board';
import { emptyModel } from '@/engine/model';
import type { BoardModel } from '@/engine/types';
import { GitHubAuthError } from '@/lib/github/errors';
import type { RequestCall } from '@/query/instrument';
import { fullModel as readFully } from '@/test/boardModel';

import { createTimingSession, rowNeeds, type TimingSink } from './session';
import type { TimingSummary } from './summary';
import { TIMING_NAMES } from './targets';

const github = (repo?: string, credentialId = 'demo-github'): RequestCall => ({
  provider: 'github',
  kind: 'listWorkflowRuns',
  credentialId,
  ...(repo ? { repo } : {}),
});

const rowById = (id: string) => {
  const row = demoDashboard.rows.find((r) => r.id === id);
  if (!row) throw new Error(`no row ${id}`);
  return row;
};

describe('rowNeeds', () => {
  it('attributes GitHub reads by repo and token, Amplify reads by app', () => {
    const api = rowById('api-core');
    const site = rowById('marketing-site');
    expect(rowNeeds(demoDashboard, api, github('acme/api-core'))).toBe(true);
    // Another repo, another token, or no repo (the budget read): not needed.
    expect(rowNeeds(demoDashboard, api, github('acme/orders'))).toBe(false);
    expect(rowNeeds(demoDashboard, api, github('acme/api-core', 'other'))).toBe(
      false,
    );
    expect(rowNeeds(demoDashboard, api, github())).toBe(false);
    // An Amplify row's git link: its compares are GitHub reads of its repo.
    expect(rowNeeds(demoDashboard, site, github('acme/marketing-site'))).toBe(
      true,
    );
    const app: RequestCall = {
      provider: 'amplify',
      kind: 'listJobs',
      credentialId: 'demo-aws',
      region: 'us-east-1',
      appId: 'd1demomarketing',
    };
    expect(rowNeeds(demoDashboard, site, app)).toBe(true);
    expect(rowNeeds(demoDashboard, site, { ...app, region: 'eu-west-1' })).toBe(
      false,
    );
    expect(rowNeeds(demoDashboard, api, app)).toBe(false);
  });
});

/** The demo board fully read, as the board model publishes it. */
const fullModel = (): Promise<BoardModel> => readFully(demoDashboard);

/** `model` with only the cells of `rowIds`. */
const onlyRows = (model: BoardModel, rowIds: string[]): BoardModel => ({
  ...model,
  cells: Object.fromEntries(
    Object.entries(model.cells).filter(
      ([, c]) => c && rowIds.includes(c.rowId),
    ),
  ),
});

function setup(pageLoad?: string, dashboard = demoDashboard) {
  let now = 1_000;
  const reports: TimingSummary[] = [];
  const sink: TimingSink & { marks: string[]; measures: string[] } = {
    marks: [],
    measures: [],
    mark: (name) => sink.marks.push(name),
    measure: (name) => sink.measures.push(name),
    report: (s) => reports.push(s),
  };
  const session = createTimingSession({
    dashboard,
    kind: 'demo',
    demoLatencyMs: 300,
    ...(pageLoad ? { pageLoad } : {}),
    clock: () => now,
    sink,
    strayRequests: () => 0,
  });
  const advance = (ms: number) => {
    now += ms;
  };
  return { session, sink, reports, advance };
}

describe('createTimingSession', () => {
  it('times each request with its outcome and rows, rethrowing failures', async () => {
    const { session, sink, advance } = setup();
    const value = await session.around(github('acme/api-core'), () => {
      advance(250);
      return Promise.resolve('runs');
    });
    expect(value).toBe('runs');
    const failure = session.around(github('acme/legacy-billing'), () => {
      advance(40);
      return Promise.reject(new GitHubAuthError('runs'));
    });
    await expect(failure).rejects.toBeInstanceOf(GitHubAuthError);
    // A rejection that isn't an Error is recorded too, and passed on as is.
    const thrown: unknown = 'plain string';
    await expect(
      session.around(github('acme/orders'), (): Promise<never> => {
        throw thrown;
      }),
    ).rejects.toBe('plain string');
    expect(
      session.requests().map((r) => [r.end - r.start, r.outcome, r.rowIds]),
    ).toEqual([
      [250, 'ok', ['api-core']],
      [40, 'GitHubAuthError', ['legacy-billing']],
      [0, 'Error', ['orders']],
    ]);
    expect(sink.measures).toEqual(
      Array.from(
        { length: 3 },
        () => `${TIMING_NAMES.request} github listWorkflowRuns`,
      ),
    );
  });

  it('marks the first status cell, then reports once at the full board', async () => {
    const model = await fullModel();
    const { session, sink, reports, advance } = setup('reload');
    advance(100);
    // Only error cells (rejected credential): not a first cell yet.
    session.committed(onlyRows(model, ['legacy-billing']));
    expect(sink.marks).toEqual([TIMING_NAMES.open]);
    advance(200);
    session.committed(onlyRows(model, ['legacy-billing', 'api-core']));
    advance(700);
    session.committed(model);
    session.committed(model);
    expect(sink.marks).toEqual([
      TIMING_NAMES.open,
      TIMING_NAMES.firstCell,
      TIMING_NAMES.fullBoard,
    ]);
    expect(reports).toHaveLength(1);
    const [summary] = reports;
    expect(summary.firstCell).toEqual({ sinceOpen: 300, sinceLoad: 1_300 });
    expect(summary.fullBoard).toEqual({ sinceOpen: 1_000, sinceLoad: 2_000 });
    expect(summary.cells).toBe(
      demoDashboard.rows.length * demoDashboard.stages.length,
    );
  });

  it('reports a full board with no status cell, without a first cell', async () => {
    const model = await fullModel();
    // Every cell of this board is an error (its token is rejected).
    const board = { ...demoDashboard, rows: [rowById('legacy-billing')] };
    const { session, reports } = setup(undefined, board);
    session.committed(model);
    expect(reports).toHaveLength(1);
    expect(reports[0]?.firstCell).toBeUndefined();
    expect(reports[0]?.fullBoard).toBeDefined();
  });

  it('leaves polling after the full board out of the load', async () => {
    const model = await fullModel();
    const { session } = setup();
    await session.around(github('acme/api-core'), () => Promise.resolve(1));
    session.committed(model);
    await session.around(github('acme/api-core'), () => Promise.resolve(2));
    expect(session.requests()).toHaveLength(1);
  });

  it('reports a board closed part-way, but not one never shown', async () => {
    const model = await fullModel();
    const unseen = setup();
    unseen.session.committed(emptyModel());
    unseen.session.stop();
    expect(unseen.reports).toEqual([]);
    // Stopped: a later full board isn't reported either.
    unseen.session.committed(model);
    expect(unseen.reports).toEqual([]);

    const partial = setup();
    partial.session.committed(onlyRows(model, ['api-core']));
    partial.session.stop();
    partial.session.stop();
    expect(partial.reports).toHaveLength(1);
    expect(partial.reports[0]?.fullBoard).toBeUndefined();
    // A stopped session ignores later commits.
    partial.session.committed(model);
    expect(partial.reports).toHaveLength(1);
  });

  it('times from the page load only when given how the page loaded', async () => {
    const model = await fullModel();
    const { session, reports, advance } = setup();
    advance(500);
    session.committed(model);
    expect(reports[0]?.fullBoard).toEqual({ sinceOpen: 500 });
    expect(reports[0]?.pageLoad).toBeUndefined();
  });
});
