/**
 * Tests for references that don't resolve (reported where they are held,
 * the default used) and for source-rule problems (copy and items paths,
 * the order key).
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { DashboardSchema } from '@/domain/config/dashboard';
import { branchRules } from '@/domain/config/placement';
import { BUILTIN_SOURCES } from '@/domain/model/builtinSources';
import { all } from '@/domain/model/ruleBuilders';

import { configProblems } from './problems';

const [githubSource] = BUILTIN_SOURCES;
const base = {
  id: 'd',
  name: 'd',
  stages: [{ id: 'dev', name: 'Dev', rules: branchRules('dev') }],
  rows: [{ type: 'github', id: 'web', repo: 'a/web', displayName: 'web' }],
};
const all3 = (d: unknown) => configProblems(DashboardSchema.parse(d));

describe('references that do not resolve', () => {
  it('reports each at the level holding it, using the default', () => {
    const problems = all3({
      ...base,
      sourceRules: { github: 'nope', amplify: 'github' },
      statusSets: { github: 'gone', amplify: 'amplify' },
      rowGroups: [
        { id: 'g', memberIds: ['web'], statusSets: { github: 'amplify' } },
      ],
      rows: [
        {
          ...base.rows[0],
          statusSet: 'amplify',
          cellStatusSets: { dev: 'missing' },
        },
      ],
    }).filter((p) => p.severity === 'problem');
    expect(problems.map((p) => [p.level, p.message, p.target])).toEqual([
      [
        { kind: 'dashboard' },
        'unknown source rule nope: using the built-in GitHub rule',
        { kind: 'source', provider: 'github' },
      ],
      [
        { kind: 'dashboard' },
        'source rule github is for GitHub, not Amplify: using the built-in Amplify rule',
        { kind: 'source', provider: 'amplify' },
      ],
      [
        { kind: 'dashboard' },
        'unknown status set gone: using GitHub deploy and test',
        { kind: 'dashboard', part: 'statusSets' },
      ],
      [
        { kind: 'rowGroup', id: 'g' },
        'status set amplify is for Amplify, not GitHub: using GitHub deploy and test',
        { kind: 'rowGroup', id: 'g' },
      ],
      [
        { kind: 'row', id: 'web' },
        'status set amplify is for Amplify, not GitHub: using GitHub deploy and test',
        { kind: 'row', id: 'web' },
      ],
      [
        { kind: 'cell', rowId: 'web', stageId: 'dev' },
        'unknown status set missing: using GitHub deploy and test',
        { kind: 'row', id: 'web', stageId: 'dev' },
      ],
    ]);
  });
});

describe('source rule problems', () => {
  it('reports copy and items paths that do not parse, and an order key that is no key', () => {
    const mine = {
      ...githubSource,
      id: 'mine',
      name: 'Mine',
      keys: [
        ...githubSource.keys,
        { name: 'bad', translations: [{ rule: all(), copy: '$.run[' }] },
      ],
      items: { path: '$.jobs[', keys: [] },
      order: 'nowhere',
    };
    const problems = all3({
      ...base,
      customSourceRules: [mine],
      sourceRules: { github: 'mine', amplify: 'amplify' },
    }).filter((p) => p.target?.kind === 'source');
    expect(problems.map((p) => p.message)).toEqual([
      expect.stringMatching(/^Mine source rule: key bad copies \$\.run\[: /),
      expect.stringMatching(/^Mine source rule: items path \$\.jobs\[: /),
      'Mine source rule: order key nowhere is none of its keys, so no record is placed',
    ]);
    expect(problems.every((p) => p.level.kind === 'dashboard')).toBe(true);
  });
});
