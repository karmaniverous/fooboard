/**
 * Development aid (spec.md §3.5): the browser's timing sink. Marks and
 * measures go to User Timing (`performance.mark` and `performance.measure`,
 * shown in the browser's performance panel); each board load's summary
 * goes to the console, with Decision 30's targets beside the measures.
 *
 * @module
 */
import type { TimingSink } from './session';
import type { Moment, TimingSummary } from './summary';
import { TIMING_PREFIX } from './targets';

/** Whole milliseconds, for reading. */
const ms = (value: number | undefined): string =>
  value === undefined ? '—' : `${String(Math.round(value))} ms`;

const momentText = (name: string, moment: Moment | undefined): string =>
  `${name} ${ms(moment?.sinceOpen)}`;

/** The summary's headline: the board measures from opening and from load. */
export function headline(summary: TimingSummary): string {
  const { firstCell, fullBoard, pageLoad } = summary;
  const fromLoad =
    pageLoad === undefined
      ? ''
      : `; from page ${pageLoad}: first cell ${ms(firstCell?.sinceLoad)}, full board ${ms(fullBoard?.sinceLoad)}`;
  return `${TIMING_PREFIX} ${summary.board} (${summary.kind}, ${String(summary.cells)} cells, ${String(summary.requests.total)} requests): from opening: ${momentText('first cell', firstCell)}, ${momentText('full board', fullBoard)}${fromLoad}`;
}

/** The console summary's tables, keyed by title. */
export function summaryTables(
  summary: TimingSummary,
  rowNames: Readonly<Record<string, string>>,
): Record<string, Record<string, string | number>[]> {
  return {
    targets: summary.targets.map((t) => ({
      target: t.label,
      max: ms(t.maxMs),
      measured: ms(t.actualMs),
      met: t.met === undefined ? 'n/a' : t.met ? 'yes' : 'NO',
    })),
    'requests by kind': summary.requests.byKind.map((k) => ({
      request: `${k.provider} ${k.kind}`,
      count: k.count,
      failed: k.failed,
      median: ms(k.medianMs),
      max: ms(k.maxMs),
      total: ms(k.totalMs),
    })),
    'requests per row': summary.perRow.map((r) => ({
      row: rowNames[r.rowId] ?? r.rowId,
      requests: r.requests,
    })),
    slowest: summary.slowest.map((s) => ({
      request: `${s.provider} ${s.kind}`,
      time: ms(s.ms),
      outcome: s.outcome,
    })),
  };
}

/** A sink writing to User Timing and the console. */
export function browserSink(
  rowNames: Readonly<Record<string, string>>,
): TimingSink {
  return {
    mark: (name, at) => {
      performance.mark(name, { startTime: at });
    },
    measure: (name, start, end, detail) => {
      performance.measure(name, { start, end, detail });
    },
    report: (summary) => {
      console.groupCollapsed(headline(summary));
      for (const [title, rows] of Object.entries(
        summaryTables(summary, rowNames),
      )) {
        console.info(title);
        console.table(rows);
      }
      for (const note of summary.notes) console.info(note);
      console.groupEnd();
    },
  };
}
