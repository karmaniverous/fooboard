/**
 * Development aid (spec.md §3.5): the timing session of one board load,
 * from the engine starting to the full board. It times every request the
 * engine's providers make (as {@link Around}), attributes each to the rows
 * that needed it, notes the commit of the first non-empty status cell and
 * of the full board, and then reports the summary. Pure apart from its
 * injected clock and sink.
 *
 * @module
 */
import type { Dashboard } from '@/domain/config/dashboard';
import { rowGithubCredentialId } from '@/domain/config/inheritance';
import type { Row } from '@/domain/config/row';
import { type BoardCell, type BoardModel, cellKey } from '@/engine/types';

import type { Around, RequestCall } from './readerWrap';
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
  /** The board closed (its engine stopped). */
  stop(): void;
  /** Requests recorded so far (until the full board). */
  requests(): readonly RequestRecord[];
}

/** Does `row` need `call`'s read? GitHub reads are per repo and token (a
 * GitHub row's runs, an Amplify row's compares); Amplify reads per app. */
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
  return (
    row.type === 'amplify' &&
    row.sources.some((s) => s.appId === call.appId && s.region === call.region)
  );
}

/** A cell the current engine has published is final: it publishes a
 * target only after every read and compare (spec.md §2.6). */
const isFinal = (cell: BoardCell | undefined): boolean => cell !== undefined;

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
  let firstCell: Moment | undefined;
  let fullBoard: Moment | undefined;
  let stopped = false;
  sink.mark(TIMING_NAMES.open, openedAt);

  const moment = (at: number): Moment => ({
    sinceOpen: at - openedAt,
    ...(input.pageLoad === undefined ? {} : { sinceLoad: at }),
  });

  const record = (call: RequestCall, start: number, outcome: string) => {
    // Polling after the full board isn't part of the load.
    if (fullBoard) return;
    const end = clock();
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
      // nothing was shown yet (e.g. StrictMode's discarded first engine).
      if (firstCell && !fullBoard) sink.report(summary());
    },
    requests: () => records,
  };
}
