/**
 * Tests for configuration problems: each kind at its level (bad paths,
 * unknown keys including inside filters, item rules without items,
 * uncovered stages, Amplify rows without a GitHub credential), references
 * that don't resolve, source-rule problems (copy and items paths, the
 * order key), notes for what the check can't decide and for rules keyed
 * by a source no row uses, presets checked against a customised source
 * rule, and none for the demo board or a board built from presets.
 *
 * @module
 */
import { omit } from 'radash';
import { describe, expect, it } from 'vitest';

import { measureBoard } from '@/demo/scenarios/measure';
import { DashboardSchema } from '@/domain/config/dashboard';
import { branchRules } from '@/domain/config/placement';
import { PRESET_IDS } from '@/domain/config/statusSets';
import { BUILTIN_SOURCES } from '@/domain/model/builtinSources';
import { all, check, exists, is } from '@/domain/model/ruleBuilders';

import { configProblems } from './problems';

const [githubSource, amplifySource] = BUILTIN_SOURCES;
const base = {
  id: 'd',
  name: 'd',
  stages: [{ id: 'dev', name: 'Dev', rules: branchRules('dev') }],
  rows: [{ type: 'github', id: 'web', repo: 'a/web', displayName: 'web' }],
};
const amplifyRow = {
  type: 'amplify',
  id: 'site',
  repo: 'a/site',
  displayName: 'site',
  pinnedApps: [{ region: 'us-east-1', appId: 'x' }],
};
const all3 = (d: unknown) => configProblems(DashboardSchema.parse(d));
const messages = (d: unknown) =>
  all3(d)
    .filter((p) => p.severity === 'problem')
    .map((p) => [p.level, p.message, p.dismissable]);
const notes = (d: unknown) =>
  all3(d)
    .filter((p) => p.severity === 'note')
    .map((p) => [p.level, p.message]);

describe('configProblems', () => {
  it('finds none on the demo board or a plain board', () => {
    expect(configProblems(measureBoard).filter((p) => !p.dismissable)).toEqual(
      [],
    );
    expect(messages(base)).toEqual([]);
  });

  it('passes the built-in rules against each other, without notes', () => {
    expect(notes({ ...base, rows: [...base.rows, { ...amplifyRow }] })).toEqual(
      [],
    );
  });

  it('reports bad paths and unknown keys where the rule lives', () => {
    expect(
      messages({
        ...base,
        rows: [
          {
            ...base.rows[0],
            recordRule: all(check({ path: '$.items[', operator: 'exists' })),
            settings: { itemRules: { github: all(is('$.nme', 'x')) } },
          },
        ],
      }),
    ).toEqual([
      [
        { kind: 'row', id: 'web' },
        expect.stringMatching(/^row rule: path \$\.items\[/),
        false,
      ],
      [
        { kind: 'row', id: 'web' },
        'item rule: GitHub gives no item key nme',
        false,
      ],
    ]);
    expect(
      messages({
        ...base,
        rows: [
          {
            ...base.rows[0],
            recordRule: all(exists("$.items[?@.stat == 'x'].name")),
          },
        ],
      }),
    ).toEqual([
      [
        { kind: 'row', id: 'web' },
        'row rule: GitHub gives no item key stat',
        false,
      ],
    ]);
  });

  it('reports item rules on a source without items', () => {
    expect(
      messages({
        ...base,
        settings: { itemRules: { amplify: all(is('$.name', 'x')) } },
        rows: [],
      }),
    ).toEqual([
      [
        { kind: 'dashboard' },
        'Amplify item rule: Amplify records have no items',
        false,
      ],
    ]);
  });

  it('reports a stage no stage rule covers for a source some row uses', () => {
    expect(messages({ ...base, stages: [{ id: 'dev', name: 'Dev' }] })).toEqual(
      [
        [
          { kind: 'stage', id: 'dev' },
          'no GitHub stage rule: its GitHub cells match nothing',
          false,
        ],
      ],
    );
  });

  it('reports an Amplify row without a GitHub credential, dismissably', () => {
    expect(messages({ ...base, rows: [amplifyRow] })).toEqual([
      [
        { kind: 'row', id: 'site' },
        'no GitHub credential, so no behind or diverged badges',
        true,
      ],
    ]);
  });

  it('names the columns of an Amplify row reading with no GitHub token, dismissably', () => {
    expect(
      messages({
        ...base,
        credentials: [{ id: 'gh', kind: 'github', label: 'gh' }],
        stages: [
          ...base.stages,
          { id: 'qa', name: 'QA', rules: branchRules('qa') },
          { id: 'prod', name: 'Prod', rules: branchRules('main') },
        ],
        rows: [{ ...amplifyRow, cellSettings: { qa: { githubToken: 'gh' } } }],
      }),
    ).toEqual([
      [
        { kind: 'row', id: 'site' },
        'no GitHub credential in Dev, Prod, so no behind or diverged badges',
        true,
      ],
    ]);
  });

  it('notes a pinned app under a key no column of its row reads with', () => {
    const aws = (id: string) => ({ id, kind: 'aws', label: id.toUpperCase() });
    const problems = all3({
      ...base,
      credentials: [aws('k1'), aws('k2')],
      settings: { awsKey: 'k1' },
      rows: [
        {
          ...amplifyRow,
          pinnedApps: [
            { region: 'us-east-1', appId: 'a1', credentialId: 'k1' },
            { region: 'us-east-1', appId: 'a2', credentialId: 'k2' },
            { region: 'us-east-1', appId: 'a3' },
          ],
        },
      ],
    }).filter((p) => p.message.startsWith('Amplify app'));
    expect(
      problems.map((p) => [p.severity, p.level, p.message, p.target]),
    ).toEqual([
      [
        'note',
        { kind: 'row', id: 'site' },
        'Amplify app a2 (us-east-1) is pinned under the AWS key K2, which no column of this row reads with: set that AWS key on the columns that use it',
        {
          kind: 'settings',
          place: { level: 'row', rowId: 'site' },
          field: 'awsKey',
        },
      ],
    ]);
  });

  it('reports an Amplify row without a GitHub repo, even with a token, dismissably', () => {
    const noRepo = omit(amplifyRow, ['repo']);
    expect(
      messages({
        ...base,
        credentials: [{ id: 'gh', kind: 'github', label: 'gh' }],
        settings: { githubToken: 'gh' },
        rows: [noRepo, { ...amplifyRow, id: 'linked' }],
      }),
    ).toEqual([
      [
        { kind: 'row', id: 'site' },
        'no GitHub repo, so no behind or diverged badges',
        true,
      ],
    ]);
  });
});

describe('consistency notes and checks', () => {
  it('notes what it cannot decide, at the rule', () => {
    expect(
      notes({
        ...base,
        stages: [
          {
            id: 'dev',
            name: 'Dev',
            rules: { github: all(is('$.branch', 'dev')) },
          },
        ],
        rows: [
          {
            ...base.rows[0],
            recordRule: all(exists('$..name'), is('$.branch.x', 'y')),
          },
        ],
      }),
    ).toEqual([
      [
        { kind: 'row', id: 'web' },
        'row rule: unchecked $..name (a descendant segment)',
      ],
      [
        { kind: 'row', id: 'web' },
        'row rule: unchecked $.branch.x (inside copied key branch)',
      ],
    ]);
  });

  it('reports a path inside a key that is always text', () => {
    expect(
      messages({
        ...base,
        rows: [
          {
            ...amplifyRow,
            recordRule: all(is('$.state.x', 'y')),
          },
        ],
      }),
    ).toContainEqual([
      { kind: 'row', id: 'site' },
      "row rule: Amplify's key state is always text, so nothing is inside it",
      false,
    ]);
    expect(amplifySource.keys.some((k) => k.name === 'state')).toBe(true);
  });

  it('notes rules keyed by a source no row uses, once per source', () => {
    expect(notes(base)).toEqual([
      [
        { kind: 'dashboard' },
        'Amplify rules where no row reads Amplify, so unused: stage dev',
      ],
    ]);
  });

  it('checks the presets in use against a customised source rule', () => {
    const renamed = {
      ...githubSource,
      id: 'mine',
      name: 'Mine',
      items: {
        path: '$.jobs[*]',
        keys: (githubSource.items?.keys ?? []).map((k) =>
          k.name === 'state' ? { ...k, name: 'status' } : k,
        ),
      },
    };
    const problems = all3({
      ...base,
      customSourceRules: [renamed],
      sourceRules: { github: 'mine', amplify: 'amplify' },
    }).filter((p) => p.level.kind === 'statusSet');
    expect(problems.length).toBeGreaterThan(0);
    expect(problems[0]).toMatchObject({
      level: { kind: 'statusSet', id: PRESET_IDS.githubDeployTest },
      target: { kind: 'statusSet', id: PRESET_IDS.githubDeployTest },
      message: 'GitHub deploy and test item rule: Mine gives no item key state',
    });
  });
});
