/**
 * Tests for source-rule resolution: built-ins by id, custom rules, the
 * built-in fallback for a dangling or wrong-source id, and the integrity
 * issues the dashboard schema reports (dangling references are rule
 * problems instead).
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { BUILTIN_SOURCES } from './builtinSources';
import {
  sourceRuleFor,
  sourceRuleReferenceIssues,
  sourcesWithItems,
} from './sources';

const [github, amplify] = BUILTIN_SOURCES;
const mine = { ...github, id: 'mine', name: 'Mine' };

describe('sourceRuleFor', () => {
  it('finds built-ins and custom rules, falling back to the built-in', () => {
    const scope = (id: string) => ({
      sourceRules: { github: id, amplify: 'amplify' },
      customSourceRules: [mine],
    });
    expect(sourceRuleFor(scope('mine'), 'github')).toBe(mine);
    expect(sourceRuleFor(scope('github'), 'github')).toBe(github);
    expect(sourceRuleFor(scope('gone'), 'github')).toBe(github);
    expect(sourceRuleFor(scope('amplify'), 'github')).toBe(github);
    expect(sourceRuleFor(scope('github'), 'amplify')).toBe(amplify);
  });
});

describe('sourcesWithItems', () => {
  it('lists the sources whose rule reads items', () => {
    const scope = (rule: typeof github) => ({
      sourceRules: { github: rule.id, amplify: 'amplify' },
      customSourceRules: [rule],
    });
    expect(sourcesWithItems(scope(mine))).toEqual(
      ['github', 'amplify'].filter(
        (p) => (p === 'github' ? github : amplify).items !== undefined,
      ),
    );
    const flat = { ...github, id: 'flat', items: undefined };
    expect(sourcesWithItems(scope(flat))).not.toContain('github');
  });
});

describe('sourceRuleReferenceIssues', () => {
  it('reports shadowed and duplicate ids, not dangling references', () => {
    expect(
      sourceRuleReferenceIssues({
        sourceRules: { github: 'amplify', amplify: 'nope' },
        customSourceRules: [mine, mine, { ...mine, id: 'github' }],
      }),
    ).toEqual([
      {
        message: 'duplicate source rule id: mine',
        path: ['customSourceRules', 1, 'id'],
      },
      {
        message: "source rule id github is a built-in's",
        path: ['customSourceRules', 2, 'id'],
      },
    ]);
  });
});
