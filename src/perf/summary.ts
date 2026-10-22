/**
 * Development aid (spec.md §3.5): the pure timing summary of one board
 * load: per request its duration and outcome (grouped by kind), per row
 * the requests it needed, per board the time to first cell and to full
 * board, from opening and from the page load, against Decision 30's
 * targets ({@link PERFORMANCE_TARGETS}).
 *
 * @module
 */
import { group, sort, sum } from 'radash';

import type { Provider } from '@/domain/config/providers';
import type { RequestCall } from '@/query/instrument';

import {
  type BoardKind,
  DEMO_TARGET_LATENCY_MS,
  type Measure,
  ONE_IN_FLIGHT_MAX_SLOWDOWN,
  type Origin,
  PERFORMANCE_TARGETS,
  type PerformanceTarget,
} from './targets';

/** How many of the slowest requests the summary lists. */
export const SLOWEST_LISTED = 5;

/** The outcome of a request that resolved. */
export const OK_OUTCOME = 'ok';

/** One settled request: when it ran (ms on the page clock), how it ended
 * (`ok` or the error's name) and the rows that needed it. */
export interface RequestRecord {
  call: RequestCall;
  start: number;
  end: number;
  outcome: string;
  rowIds: readonly string[];
}

/** A board measure from the board opening and, for the first board after
 * a page load, from the page load. */
export interface Moment {
  sinceOpen: number;
  sinceLoad?: number;
}

/** Requests of one provider and kind. */
export interface KindStats {
  provider: Provider;
  kind: string;
  count: number;
  failed: number;
  medianMs: number;
  maxMs: number;
  totalMs: number;
}

/** One target with what was measured against it, when it applies. */
interface TargetResult {
  label: string;
  maxMs: number;
  actualMs?: number;
  met?: boolean;
}

/** Everything the console summary shows for one board load. */
export interface TimingSummary {
  board: string;
  kind: BoardKind;
  demoLatencyMs: number;
  cells: number;
  /** How the page loaded (`navigate`, `reload`), when this board is the
   * first since it loaded; otherwise the board was opened in the app. */
  pageLoad?: string;
  firstCell?: Moment;
  fullBoard?: Moment;
  requests: { total: number; failed: number; byKind: KindStats[] };
  /** Per row, the requests it needed (shared reads count for each row). */
  perRow: { rowId: string; requests: number }[];
  slowest: { provider: Provider; kind: string; ms: number; outcome: string }[];
  targets: TargetResult[];
  notes: string[];
}

/** The median of `values` (0 for none). Local: radash has no median. */
export function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = sort([...values], (v) => v);
  const mid = Math.floor(sorted.length / 2);
  // The middle value, or the middle two for an even count.
  const middle = sorted.slice(sorted.length % 2 ? mid : mid - 1, mid + 1);
  return sum(middle) / middle.length;
}

const duration = (r: RequestRecord): number => r.end - r.start;

/** Requests grouped by provider and kind, most time first. */
export function kindStats(records: readonly RequestRecord[]): KindStats[] {
  const groups = group(records, (r) => `${r.call.provider} ${r.call.kind}`);
  // Every group has at least one record; its first names the group.
  const stats = Object.values(groups).flatMap((list = []) =>
    list.slice(0, 1).map(({ call }) => {
      const ms = list.map(duration);
      return {
        provider: call.provider,
        kind: call.kind,
        count: list.length,
        failed: list.filter((r) => r.outcome !== OK_OUTCOME).length,
        medianMs: median(ms),
        maxMs: Math.max(...ms),
        totalMs: sum(ms),
      };
    }),
  );
  return sort(stats, (s) => s.totalMs, true);
}

/** Per row (in board order), the requests that read for it. */
export function rowRequests(
  rowIds: readonly string[],
  records: readonly RequestRecord[],
): { rowId: string; requests: number }[] {
  return rowIds.map((rowId) => ({
    rowId,
    requests: records.filter((r) => r.rowIds.includes(rowId)).length,
  }));
}

/** The measured value a target bounds, if this load can be judged by it. */
function actualFor(
  target: PerformanceTarget,
  load: { kind: BoardKind; demoLatencyMs: number; pageLoad?: string },
  moments: Record<Measure, Moment | undefined>,
): number | undefined {
  if (target.board !== 'any' && target.board !== load.kind) return undefined;
  if (load.kind === 'demo' && load.demoLatencyMs !== DEMO_TARGET_LATENCY_MS)
    return undefined;
  const moment = moments[target.measure];
  const from: Origin = load.pageLoad === 'reload' ? 'reload' : 'open';
  if (target.from !== from) return undefined;
  return from === 'reload' ? moment?.sinceLoad : moment?.sinceOpen;
}

/** Build the summary of one board load. */
export function summarise(input: {
  board: string;
  kind: BoardKind;
  demoLatencyMs: number;
  rowIds: readonly string[];
  cells: number;
  pageLoad?: string;
  firstCell?: Moment;
  fullBoard?: Moment;
  records: readonly RequestRecord[];
  /** Requests made meanwhile for boards no longer shown (e.g. a closed
   * board's polling, or the engine
   * React's development StrictMode starts and stops). */
  strayRequests: number;
}): TimingSummary {
  const { records, kind, demoLatencyMs, pageLoad } = input;
  const moments = { firstCell: input.firstCell, fullBoard: input.fullBoard };
  const targets = PERFORMANCE_TARGETS.map((target) => {
    const actualMs = actualFor(target, input, moments);
    return {
      label: target.label,
      maxMs: target.maxMs,
      ...(actualMs === undefined
        ? {}
        : { actualMs, met: actualMs <= target.maxMs }),
    };
  });
  const notes = [
    `At 1 request in flight per credential, full board may be at most ${String(ONE_IN_FLIGHT_MAX_SLOWDOWN * 100)}% slower than the N1 baseline.`,
  ];
  if (kind === 'demo' && demoLatencyMs !== DEMO_TARGET_LATENCY_MS)
    notes.push(
      `Demo targets assume ${String(DEMO_TARGET_LATENCY_MS)} ms latency; this load had ${String(demoLatencyMs)} ms.`,
    );
  if (input.strayRequests > 0)
    notes.push(
      `${String(input.strayRequests)} requests ran meanwhile for boards no longer shown (StrictMode's discarded engine, or a closed board's reads still running), sharing the credentials' queues.`,
    );
  return {
    board: input.board,
    kind,
    demoLatencyMs,
    cells: input.cells,
    ...(pageLoad === undefined ? {} : { pageLoad }),
    ...(input.firstCell ? { firstCell: input.firstCell } : {}),
    ...(input.fullBoard ? { fullBoard: input.fullBoard } : {}),
    requests: {
      total: records.length,
      failed: records.filter((r) => r.outcome !== OK_OUTCOME).length,
      byKind: kindStats(records),
    },
    perRow: rowRequests(input.rowIds, records),
    slowest: sort([...records], duration, true)
      .slice(0, SLOWEST_LISTED)
      .map((r) => ({
        provider: r.call.provider,
        kind: r.call.kind,
        ms: duration(r),
        outcome: r.outcome,
      })),
    targets,
    notes,
  };
}
