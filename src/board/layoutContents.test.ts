/**
 * Tests for worst-case contents (spec.md C-13) on the demo board: headers
 * and group labels are included, fixed fields use their longest forms,
 * the badge moves after the commit from rung 3, and free text appears only
 * at rungs 4 and 5.
 *
 * @module
 */
import { beforeAll, describe, expect, it } from 'vitest';

import { demoDashboard } from '@/demo/board';
import type { BoardModel } from '@/engine';
import { fullModel } from '@/test/boardModel';

import { boardContents, firstLine } from './layoutContents';

let model: BoardModel;

beforeAll(async () => {
  model = await fullModel(demoDashboard);
});

describe('boardContents', () => {
  it('includes headers and group labels, and grows with the rung', () => {
    const contents = boardContents(demoDashboard, model);
    const leads = contents(1).map((c) => c.lead);
    for (const stage of demoDashboard.stages)
      expect(leads).toContain(stage.name);
    const status = (rung: 0 | 1 | 2 | 3 | 4 | 5) =>
      contents(rung).find((c) => c.lead.startsWith('\u2298'));
    const keys = (rung: 0 | 1 | 2 | 3 | 4 | 5) =>
      status(rung)?.items.map((i) => i.key);
    expect(status(0)?.lead).toBe('\u2298');
    expect(keys(1)).toEqual([]);
    expect(keys(2)).toEqual(['time']);
    expect(keys(3)).toEqual(['time', 'commit']);
    // The badge moves from the lead to the commit at rung 3.
    expect(status(2)?.badge).toBeDefined();
    expect(status(3)?.badge).toBeUndefined();
    expect(status(3)?.items[1]?.badge).toBeDefined();
    const free = (rung: 3 | 4) =>
      contents(rung).some((c) => c.items.some((i) => i.free));
    expect(free(3)).toBe(false);
    expect(free(4)).toBe(true);
  });

  it('takes the first line of a commit message', () => {
    expect(firstLine('Fix flaky test\n\nLonger body')).toBe('Fix flaky test');
  });
});
