/**
 * Tests for the cells both refreshers build: views active only while in
 * progress, and empty cells saying why.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { deriveCell } from '@/domain/derivation';
import { presetById } from '@/domain/statuses/presets';

import { cellView, cellViews, emptyCells } from './cells';

const set = presetById('amplify');
const running = set.cell.find((c) => c.summary === 'running');
const done = set.cell.find((c) => c.summary === 'ok');

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
      dev: { kind: 'empty', state: 'needs-credential' },
      prod: { kind: 'empty', state: 'needs-credential' },
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
