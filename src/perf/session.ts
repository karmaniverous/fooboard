/**
 * Development aid (spec.md §3.5): the timing session of one board load,
 * from the board model starting to the full board. It times every request
 * the query layer sends (as {@link Around}), attributes each to the rows
 * that needed it, notes the commit of the first non-empty status cell and
 * of the full board, and then reports the summary. Pure apart from its
 * injected clock and sink.
 *
 * @module
 */
import { resolveCredentialId } from '@/domain/config/credentialRefs';
import type { Dashboard } from '@/domain/config/dashboard';
import {
  inheritedCredentials,
  rowGithubCredentialId,
} from '@/domain/config/inheritance';
import type { Row } from '@/domain/config/row';
import { type BoardCell, type BoardModel, cellKey } from '@/engine/types';
import type { Around, RequestCall } from '@/query/instrument';

import {
  type Moment,
  OK_OUTCOME,
  type RequestRecord,
  summarise,
  type TimingSummary,
} from './summary';
import { type BoardKind, TIMING_NAMES } from './targets';

/** Where the session reports (User Timing and the console in the app). */
export interface TimingSink {
  mark(name: string, at: number): void;
  measure(name: string, start: number, end: number, detail: unknown): void;
  report(summary: TimingSummary): void;
}

export interface TimingSessionInput {
  dashboard: Dashboard;
  kind: BoardKind;
  demoLatencyMs: number;
  /** How the page loaded, when this is the first board since it loaded. */
  pageLoad?: string;
  /** The page clock (ms since the page started loading). */
  clock: () => number;
  sink: TimingSink;
  /** Requests made meanwhile for boards no longer shown. */
  strayRequests: () => number;
}

export interface TimingSession {
  /** Time a request and attribute it to its rows. */
  around: Around;
  /** The board committed `model` to the DOM. */
  committed(model: BoardModel): void;
  /** The board closed (its board model stopped). */
  stop(): void;
  /** Requests recorded so far (until the full board). */
  requests(): readonly RequestRecord[];
  /** When each request that may be stray for a later board settled: the
   * load's, and any (e.g. polling) that settled after the board closed. */
  settled(): readonly number[];
}

/** Does `row` need `call`'s read? GitHub reads are per repo and token (a
 * GitHub row's runs, an Amplify row's compares); Amplify reads per app,
 * region and key (`appKey`), the key being the source's own,
 * else the one its row inherits (spec.md C-1a). */
export function rowNeeds(
  dashboard: Dashboard,
  row: Row,
  call: RequestCall,
): boolean {
  if (call.provider === 'github')
    return (
      call.repo !== undefined &&
      row.repo === call.repo &&
      rowGithubCredentialId(dashboard, row) === call.credentialId
    );
  if (row.type !== 'amplify') return false;
  const defaults = inheritedCredentials(dashboard, row.id);
  return row.sources.some(
    (s) =>
      s.appId === call.appId &&
      s.region === call.region &&
      resolveCredentialId(defaults, 'aws', s.credentialId) ===
        call.credentialId,
  );
}

/** A cell is final once it is settled: not provisional, and its compares
 * have answered (Decision 30). */
const isFinal = (cell: BoardCell | undefined): boolean =>
  cell?.settled === true;

/** The outcome of a rejection that isn't an `Error`. */
const UNKNOWN_FAILURE = 'Error';

const outcomeOf = (err: unknown): string =>
  err instanceof Error ? err.name : UNKNOWN_FAILURE;

export function createTimingSession(input: TimingSessionInput): TimingSession {
  const { dashboard, clock, sink } = input;
  const openedAt = clock();
  const keys = dashboard.rows.flatMap((r) =>
    dashboard.stages.map((s) => cellKey(r.id, s.id)),
  );
  const records: RequestRecord[] = [];
  /** When requests made after the full board settled, once it closed. */
  const settledAfterClose: number[] = [];
  let firstCell: Moment | undefined;
  let fullBoard: Moment | undefined;
  let stopped = false;
  sink.mark(TIMING_NAMES.open, openedAt);

  const moment = (at: number): Moment => ({
    sinceOpen: at - openedAt,
    ...(input.pageLoad === undefined ? {} : { sinceLoad: at }),
  });

  const record = (call: RequestCall, start: number, outcome: string) => {
    const end = clock();
    // Polling after the full board isn't part of the load, but once the
    // board has closed, what still settles may be stray for the next one.
    // (Its board model stops before the next board's starts, so polling while
    // it's open is never stray, and needn't be kept.)
    if (fullBoard) {
      if (stopped) settledAfterClose.push(end);
      return;
    }
    const rowIds = dashboard.rows
      .filter((row) => rowNeeds(dashboard, row, call))
      .map((row) => row.id);
    records.push({ call, start, end, outcome, rowIds });
    sink.measure(
      `${TIMING_NAMES.request} ${call.provider} ${call.kind}`,
      start,
      end,
      { ...call, outcome, rowIds },
    );
  };

  const around: Around = async (call, run) => {
    const start = clock();
    try {
      const value = await run();
      record(call, start, OK_OUTCOME);
      return value;
    } catch (err) {
      record(call, start, outcomeOf(err));
      throw err;
    }
  };

  const summary = (): TimingSummary =>
    summarise({
      board: dashboard.name,
      kind: input.kind,
      demoLatencyMs: input.demoLatencyMs,
      rowIds: dashboard.rows.map((r) => r.id),
      cells: keys.length,
      ...(input.pageLoad === undefined ? {} : { pageLoad: input.pageLoad }),
      ...(firstCell ? { firstCell } : {}),
      ...(fullBoard ? { fullBoard } : {}),
      records,
      strayRequests: input.strayRequests(),
    });

  return {
    around,
    committed(model) {
      if (stopped || fullBoard) return;
      const at = clock();
      if (
        !firstCell &&
        keys.some((k) => {
          const kind = model.cells[k]?.derivation.kind;
          return kind !== undefined && kind !== 'empty';
        })
      ) {
        firstCell = moment(at);
        sink.mark(TIMING_NAMES.firstCell, at);
        sink.measure(TIMING_NAMES.firstCell, openedAt, at, firstCell);
      }
      if (keys.every((k) => isFinal(model.cells[k]))) {
        fullBoard = moment(at);
        sink.mark(TIMING_NAMES.fullBoard, at);
        const result = summary();
        sink.measure(TIMING_NAMES.fullBoard, openedAt, at, result);
        sink.report(result);
      }
    },
    stop() {
      if (stopped) return;
      stopped = true;
      // A board closed before it was full reports what it had, unless
      // nothing was shown yet (e.g. StrictMode's discarded first board model).
      if (firstCell && !fullBoard) sink.report(summary());
    },
    requests: () => records,
    settled: () => [...records.map((r) => r.end), ...settledAfterClose],
  };
}
