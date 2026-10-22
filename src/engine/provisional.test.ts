/**
 * Tests for provisional cells (spec.md §3.1, Decision 37): a run alone maps
 * to a preset summary status (queued, waiting, requested and pending count
 * as Running; failure and timeout as Failing); the cell takes the look of
 * the set's summary status of that name, matched regardless of case, or a
 * neutral mark when the set has none; Running is always in progress; an
 * unmapped conclusion shows no provisional cell.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import type { SummaryStatus } from '@/domain/config/statusSets';
import {
  PRESET_SUMMARY,
  PRESET_SUMMARY_IDS,
} from '@/domain/statuses/presetRules';

import { PROVISIONAL_STATUS_ID, provisionalCell } from './provisional';

const record = { branch: 'main', commit: 'abc', message: 'Fix', link: 'u' };
const preset = (id: string) => {
  const found = PRESET_SUMMARY.find((s) => s.id === id);
  if (!found) throw new Error(`no preset ${id}`);
  return found;
};
const run = (status: string, conclusion: string | null = null) => ({
  status,
  conclusion,
});
const presetSet = { summary: PRESET_SUMMARY };

describe('provisionalCell', () => {
  it.each(['queued', 'in_progress', 'waiting', 'requested', 'pending'])(
    'shows a %s run as Running, in progress',
    (status) => {
      const cell = provisionalCell(presetSet, run(status), record);
      expect(cell?.look).toBe('status');
      expect(cell?.result.kind === 'ok' && cell.result.status).toMatchObject({
        id: PROVISIONAL_STATUS_ID,
        name: preset(PRESET_SUMMARY_IDS.running).name,
        summary: { inProgress: true },
      });
    },
  );

  it.each([
    ['failure', PRESET_SUMMARY_IDS.failing],
    ['timed_out', PRESET_SUMMARY_IDS.failing],
    ['cancelled', PRESET_SUMMARY_IDS.cancelled],
    ['success', PRESET_SUMMARY_IDS.ok],
  ])('maps a completed run’s %s to %s', (conclusion, id) => {
    const cell = provisionalCell(
      presetSet,
      run('completed', conclusion),
      record,
    );
    expect(cell?.result.kind === 'ok' && cell.result.status.name).toBe(
      preset(id).name,
    );
  });

  it('shows nothing for a conclusion no summary status covers', () => {
    expect(
      provisionalCell(presetSet, run('completed', 'skipped'), record),
    ).toBeUndefined();
  });

  it('takes a custom set’s status of the same name, case aside', () => {
    const custom: SummaryStatus[] = [
      {
        id: 'mine',
        name: 'RUNNING',
        color: '#123456',
        icon: 'running',
        inProgress: false,
      },
    ];
    const cell = provisionalCell({ summary: custom }, run('queued'), record);
    expect(cell?.look).toBe('status');
    expect(cell?.result.kind === 'ok' && cell.result.status).toMatchObject({
      name: 'RUNNING',
      color: '#123456',
      rank: 0,
      // Running stays in progress whatever the custom status says.
      summary: { inProgress: true },
    });
  });

  it('marks the cell neutral when the set has no status of that name', () => {
    const custom: SummaryStatus[] = [
      {
        id: 'red',
        name: 'Broken',
        color: '#ff0000',
        icon: 'failure',
        inProgress: false,
      },
    ];
    const cell = provisionalCell(
      { summary: custom },
      run('completed', 'failure'),
      record,
    );
    expect(cell?.look).toBe('neutral');
    expect(cell?.result.kind === 'ok' && cell.result.status).toMatchObject({
      name: preset(PRESET_SUMMARY_IDS.failing).name,
      rank: custom.length,
    });
  });

  it('carries the run’s record into the cell', () => {
    const cell = provisionalCell(presetSet, run('in_progress'), record);
    expect(cell?.result).toMatchObject({
      branch: 'main',
      commit: 'abc',
      message: 'Fix',
      linkUrl: 'u',
      document: record,
    });
  });
});
