/**
 * Tests for the board model's window hints (spec.md §4.3.7 *Reader
 * options*): when a GitHub repo's runs or an Amplify branch's jobs come
 * back as many as the source rule reads, each empty (*No records*) cell
 * of the rows reading them gets a dismissable hint that opens the Sources
 * tab; a read that comes back short gives none.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { measureBoard } from '@/demo/scenarios/measure';
import type { Dashboard } from '@/domain/config/dashboard';
import type { Provider } from '@/domain/config/providers';
import type { Row } from '@/domain/config/row';
import { EMPTY_STATES } from '@/domain/derivation';
import { never } from '@/domain/model/ruleBuilders';
import { sourceRuleFor } from '@/domain/model/sources';
import type { Problem } from '@/domain/problems/problem';
import { rowSetting } from '@/domain/settings/resolve';
import { customiseSource } from '@/editors/sources/customSource';
import { fullModel } from '@/test/boardModel';

import { cellKey } from './types';

/** The demo with `provider`'s source reading a single record. Amplify's
 * keeps none of the jobs it reads, so a cell whose branch was read full
 * (one job) still shows *No records*: Amplify hints only where a matching
 * branch's own read came back full (spec 0.2.0 §3.B), and a custom rule
 * changing only the reader and `keep` is judged per branch (Decision
 * 103). */
function readingOne(provider: Provider): Dashboard {
  const custom = customiseSource(
    measureBoard,
    sourceRuleFor(measureBoard, provider).id,
  );
  return {
    ...custom,
    customSourceRules: custom.customSourceRules.map((rule) =>
      rule.provider === 'github'
        ? { ...rule, reader: { ...rule.reader, runs: 1 } }
        : {
            ...rule,
            keep: never,
            reader: { ...rule.reader, jobsPerBranch: 1 },
          },
    ),
  };
}

const hints = (problems: Problem[], provider: Provider) =>
  problems.filter(
    (p) =>
      p.target?.kind === 'source' &&
      'provider' in p.target &&
      p.target.provider === provider,
  );

describe('board model window hints', () => {
  it('gives none when every read came back short', async () => {
    const model = await fullModel(measureBoard);
    expect(hints(model.problems, 'github')).toEqual([]);
    expect(hints(model.problems, 'amplify')).toEqual([]);
  });

  it.each(['github', 'amplify'] as const)(
    'hints at each empty %s cell when its read came back full',
    async (provider) => {
      const dashboard = readingOne(provider);
      const model = await fullModel(dashboard);
      const found = hints(model.problems, provider);
      expect(found.length).toBeGreaterThan(0);
      for (const hint of found) {
        expect(hint.dismissable).toBe(true);
        const { level } = hint;
        if (level.kind !== 'cell') throw new Error('not a cell hint');
        const row = dashboard.rows.find((r) => r.id === level.rowId);
        expect(row?.type).toBe(provider === 'github' ? 'github' : 'amplify');
        const cell = model.cells[cellKey(level.rowId, level.stageId)];
        expect(cell?.derivation).toMatchObject({
          kind: 'empty',
          state: EMPTY_STATES.noRecords,
        });
      }
    },
  );

  it.each(['github', 'amplify'] as const)(
    'hints at every %s row reading the same repo or app',
    async (provider) => {
      const base = readingOne(provider);
      const level = hints((await fullModel(base)).problems, provider).at(
        0,
      )?.level;
      if (level?.kind !== 'cell') throw new Error('no cell hint');
      const original = base.rows.find((r) => r.id === level.rowId);
      if (!original) throw new Error('no hinted row');
      // The twin sits outside the original's row group, so it sets the
      // AWS key the original inherits.
      const awsKey = rowSetting(base, original, 'awsKey').value;
      const twin: Row =
        original.type === 'amplify'
          ? {
              ...original,
              id: `${original.id}-twin`,
              settings: { ...original.settings, awsKey },
            }
          : { ...original, id: `${original.id}-twin` };
      const model = await fullModel({ ...base, rows: [...base.rows, twin] });
      const hinted = hints(model.problems, provider).flatMap((h) =>
        h.level.kind === 'cell' ? [h.level.rowId] : [],
      );
      expect(hinted).toContain(original.id);
      expect(hinted).toContain(twin.id);
    },
  );
});
