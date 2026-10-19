/**
 * Tests for problems found while reading: translation problems grouped by
 * key with a count and a sample, and the dismissable window hint.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import {
  BUILTIN_SOURCES,
  builtinSourceFor,
} from '@/domain/model/builtinSources';
import {
  DEFAULT_AMPLIFY_JOBS_PER_BRANCH,
  DEFAULT_GITHUB_RUNS,
} from '@/domain/model/sourceRule';

import { readLimit, translationProblems, windowHint } from './runtime';

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
    const source = builtinSourceFor('github');
    const hint = windowHint({ rowId: 'web', stageId: 'dev' }, source);
    expect(hint).toMatchObject({
      level: { kind: 'cell', rowId: 'web', stageId: 'dev' },
      target: { kind: 'source', provider: 'github' },
      dismissable: true,
    });
    expect(hint.message).toContain(`read ${readLimit(source)},`);
  });

  it('names what each source reads', () => {
    const github = builtinSourceFor('github');
    const amplify = builtinSourceFor('amplify');
    expect(readLimit(github)).toBe(`${String(DEFAULT_GITHUB_RUNS)} runs`);
    expect(
      readLimit({ ...github, reader: { ...github.reader, runs: 7 } }),
    ).toBe('7 runs');
    expect(readLimit(amplify)).toBe(
      `${String(DEFAULT_AMPLIFY_JOBS_PER_BRANCH)} jobs per branch`,
    );
    expect(
      windowHint({ rowId: 'site', stageId: 'prod' }, amplify).target,
    ).toEqual({ kind: 'source', provider: 'amplify' });
  });
});
