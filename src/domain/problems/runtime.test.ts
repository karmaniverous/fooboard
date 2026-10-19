/**
 * Tests for problems found while reading: translation problems grouped by
 * key with a count and a sample, and the dismissable window hint.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { BUILTIN_SOURCES } from '@/domain/model/builtinSources';

import { translationProblems, windowHint } from './runtime';

const [github] = BUILTIN_SOURCES;

describe('translationProblems', () => {
  it('groups by key, counting and sampling', () => {
    const problems = translationProblems(github, [
      {
        key: 'state',
        scope: 'item',
        kind: 'untranslated',
        sample: { status: 'odd' },
      },
      {
        key: 'state',
        scope: 'item',
        kind: 'untranslated',
        sample: { status: 'odder' },
      },
      { key: 'branch', scope: 'record', kind: 'multiple-values', sample: 1 },
    ]);
    expect(problems.map((p) => p.message)).toEqual([
      'GitHub source rule: no translation matched item key state (2× e.g. {"status":"odd"})',
      'GitHub source rule: copy found several values for key branch (1× e.g. 1)',
    ]);
    expect(
      problems.every((p) => p.level.kind === 'dashboard' && !p.dismissable),
    ).toBe(true);
    expect(problems[0].target).toEqual({
      kind: 'source',
      provider: 'github',
      key: 'state',
    });
  });
});

describe('windowHint', () => {
  it('marks the empty cell, is fixed on the Sources tab and can be dismissed', () => {
    const hint = windowHint(
      { rowId: 'web', stageId: 'dev' },
      'github',
      '100 runs',
    );
    expect(hint).toMatchObject({
      level: { kind: 'cell', rowId: 'web', stageId: 'dev' },
      target: { kind: 'source', provider: 'github' },
      dismissable: true,
    });
    expect(hint.message).toContain('read 100 runs');
  });
});
