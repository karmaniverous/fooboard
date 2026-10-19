/**
 * Tests for configuration problems: each kind at its level (bad paths,
 * unknown keys including inside filters, item rules without items,
 * uncovered stages, Amplify rows without a GitHub credential), and none
 * for the demo board or a board built from presets.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { demoDashboard } from '@/demo/board';
import { DashboardSchema } from '@/domain/config/dashboard';
import { branchRules } from '@/domain/config/placement';
import { all, check, exists, is } from '@/domain/model/ruleBuilders';

import { configProblems } from './problems';

const base = {
  id: 'd',
  name: 'd',
  stages: [{ id: 'dev', name: 'Dev', rules: branchRules('dev') }],
  rows: [{ type: 'github', id: 'web', repo: 'a/web', displayName: 'web' }],
};
const messages = (d: unknown) =>
  configProblems(DashboardSchema.parse(d)).map((p) => [
    p.level,
    p.message,
    p.dismissable,
  ]);

describe('configProblems', () => {
  it('finds none on the demo board or a plain board', () => {
    expect(configProblems(demoDashboard).filter((p) => !p.dismissable)).toEqual(
      [],
    );
    expect(messages(base)).toEqual([]);
  });

  it('reports bad paths and unknown keys where the rule lives', () => {
    expect(
      messages({
        ...base,
        rows: [
          {
            ...base.rows[0],
            recordRule: all(check({ path: '$.items[', operator: 'exists' })),
            itemRule: all(is('$.nme', 'x')),
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
        rowRules: { amplify: { items: all(is('$.name', 'x')) } },
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
    expect(
      messages({
        ...base,
        rows: [
          {
            type: 'amplify',
            id: 'site',
            repo: 'a/site',
            displayName: 'site',
            sources: [{ region: 'us-east-1', appId: 'x' }],
          },
        ],
      }),
    ).toEqual([
      [
        { kind: 'row', id: 'site' },
        'no GitHub credential, so no behind or diverged badges',
        true,
      ],
    ]);
  });
});
