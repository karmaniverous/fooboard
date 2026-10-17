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
import { type BoardModel, createBoardEngine, demoProviders } from '@/engine';

import { boardContents, firstLine } from './layoutContents';

let model: BoardModel;

beforeAll(async () => {
  const engine = createBoardEngine({
    dashboard: demoDashboard,
    providers: demoProviders(() => 0),
    visibility: { isHidden: () => false, onChange: () => () => undefined },
  });
  await engine.refreshAll();
  model = engine.getModel();
});

describe('boardContents', () => {
  it('includes headers and group labels, and grows with the rung', () => {
    const contents = boardContents(demoDashboard, model);
    const leads = contents(1).map((c) => c.lead);
    for (const stage of demoDashboard.stages)
      expect(leads).toContain(stage.name);
    const ok = (rung: 1 | 2 | 3 | 4 | 5) =>
      contents(rung).find((c) => c.badge !== undefined);
    expect(ok(1)).toMatchObject({ rest: [], badgeAfterFirst: false });
    expect(ok(2)?.rest).toEqual(['59m']);
    expect(ok(3)).toMatchObject({
      rest: ['0000000', '59m', 'deploy'],
      badgeAfterFirst: true,
    });
    expect(contents(3).some((c) => (c.free ?? []).length > 0)).toBe(false);
    expect(contents(4).some((c) => (c.free ?? []).length > 0)).toBe(true);
  });

  it('takes the first line of a commit message', () => {
    expect(firstLine('Fix flaky test\n\nLonger body')).toBe('Fix flaky test');
  });
});
