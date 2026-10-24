/**
 * Tests for per-cell GitHub tokens (spec.md §3.11: every consumer asks
 * per cell): a GitHub row's columns read under the token each resolves
 * to, a column whose token has no secret shows *Needs credential* while
 * the row's other columns read, and the row's parts merge back into one.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { demoDashboard } from '@/demo/board';
import type { Dashboard } from '@/domain/config/dashboard';
import { EMPTY_STATES } from '@/domain/derivation';
import { problem } from '@/domain/problems/problem';
import { createQueryEnv } from '@/query/client';
import { fullModel, withoutRetryDelay } from '@/test/boardModel';

import { mergeDerivations, segments } from './cellSegments';
import { demoProviders } from './demoProviders';
import { githubCredentialIds } from './model';
import { cellKey } from './types';

const [first, ...rest] = demoDashboard.stages;
const api = demoDashboard.rows.find((r) => r.type === 'github');
if (!api) throw new Error('the demo has a GitHub row');

/** The demo with the first column reading GitHub with `token`. */
const withColumnToken = (token: string): Dashboard => ({
  ...demoDashboard,
  stages: [{ ...first, settings: { githubToken: token } }, ...rest],
});

/** A demo env with no secret for `locked`, recording the tokens read. */
function env(read: Set<string>) {
  return withoutRetryDelay(
    createQueryEnv({
      providers: (hooks) => {
        const demo = demoProviders(hooks, () => 0);
        return {
          ...demo,
          github: (id) => {
            if (id === 'locked') return undefined;
            read.add(id);
            return demo.github(id);
          },
        };
      },
    }),
  );
}

describe('per-cell GitHub tokens', () => {
  it('shows Needs credential only in the column whose token has no secret', async () => {
    const model = await fullModel(withColumnToken('locked'), env(new Set()));
    const state = (stageId: string) => {
      const d = model.cells[cellKey(api.id, stageId)]?.derivation;
      return d?.kind === 'empty' ? d.state : d?.kind;
    };
    expect(state(first.id)).toBe(EMPTY_STATES.needsCredential);
    expect(rest.map((s) => state(s.id))).not.toContain(
      EMPTY_STATES.needsCredential,
    );
  });

  it("keeps a battery for every column's token", () => {
    expect(githubCredentialIds(withColumnToken('other'))).toEqual(
      expect.arrayContaining(['other', demoDashboard.settings.githubToken]),
    );
  });

  it("reads each column's repo with the column's own token", async () => {
    const read = new Set<string>();
    await fullModel(withColumnToken('other'), env(read));
    expect(read.has('other')).toBe(true);
    expect(read.has(String(demoDashboard.settings.githubToken))).toBe(true);
  });
});

describe('cell segments', () => {
  it('groups columns by key in order of first appearance', () => {
    const keys: Record<string, string> = { a: 'x', b: 'y', c: 'x' };
    const stages = ['a', 'b', 'c'].map((id) => ({
      id,
      name: id,
      rules: {},
      settings: {},
    }));
    expect(
      segments(stages, (id) => keys[id]).map((s) => [
        s.key,
        s.stages.map((x) => x.id),
      ]),
    ).toEqual([
      ['x', ['a', 'c']],
      ['y', ['b']],
    ]);
  });

  it('merges parts: cells joined, one problem per id, the oldest refresh', () => {
    const twice = problem({ kind: 'row', id: 'r' }, 'failed', true);
    expect(
      mergeDerivations([
        { cells: {}, needs: [], problems: [twice], refreshedAt: 5 },
        { cells: {}, needs: [], problems: [twice], refreshedAt: 3 },
        { cells: {}, needs: [], problems: [] },
      ]),
    ).toEqual({ cells: {}, needs: [], problems: [twice], refreshedAt: 3 });
    expect(mergeDerivations([])).toEqual({
      cells: {},
      needs: [],
      problems: [],
    });
  });
});
