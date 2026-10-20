/**
 * Tests for the cells both refreshers build: views active only while in
 * progress, and empty cells saying why.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { PRESET_IDS } from '@/domain/config/statusSets';
import { deriveCell, EMPTY_STATES } from '@/domain/derivation';
import { PRESET_SUMMARY_IDS } from '@/domain/statuses/presetRules';
import { presetById } from '@/domain/statuses/presets';

import { cellView, cellViews, emptyCells } from './cells';

const set = presetById(PRESET_IDS.amplify);
const running = set.cell.find((c) => c.summary === PRESET_SUMMARY_IDS.running);
const done = set.cell.find((c) => c.summary === PRESET_SUMMARY_IDS.ok);

const placed = (status: typeof running) =>
  deriveCell({
    placed: { record: {}, status, time: null, link: null },
    set,
    credentialStatus: 'ok',
  });

describe('cellView', () => {
  it('is active only while the status is in progress', () => {
    expect(cellView(placed(running)).active).toBe(true);
    expect(cellView(placed(done)).active).toBe(false);
    expect(cellViews({ a: placed(running), b: placed(done) })).toMatchObject({
      a: { active: true },
      b: { active: false },
    });
  });
});

describe('emptyCells', () => {
  const stages = [{ id: 'dev' }, { id: 'prod' }];

  it('gives every stage a cell saying why it is empty', () => {
    expect(emptyCells(stages, () => set, 'missing')).toEqual({
      dev: { kind: 'empty', state: EMPTY_STATES.needsCredential },
      prod: { kind: 'empty', state: EMPTY_STATES.needsCredential },
    });
    expect(
      emptyCells(stages, () => set, 'ok', {
        message: 'boom',
        isRateLimit: false,
      }).dev,
    ).toEqual({ kind: 'empty', state: 'error', reason: 'boom' });
  });

  it('asks for each stage its own status set', () => {
    const asked: string[] = [];
    emptyCells(
      stages,
      (id) => {
        asked.push(id);
        return set;
      },
      'expired',
    );
    expect(asked).toEqual(['dev', 'prod']);
  });
});
