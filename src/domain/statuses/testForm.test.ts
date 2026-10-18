/**
 * Tests for the status-test form: every form condition round-trips through
 * JSON Schema; the schemas behave as the conditions say on real documents;
 * other schemas (the presets', hand edits) are not representable.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { classify } from './classify';
import { PRESETS } from './presets';
import { type Condition, fromSchema, toSchema } from './testForm';

const conditions: Condition[][] = [
  [],
  // No values yet (mid-edit): still the form's.
  [{ scope: 'value', field: 'status', operator: 'oneOf', value: '' }],
  [
    {
      scope: 'value',
      field: 'status',
      operator: 'oneOf',
      value: 'FAILED, CANCELLED',
    },
  ],
  [
    {
      scope: 'anyJob',
      field: 'name',
      operator: 'contains',
      value: 'deploy (prod)',
    },
  ],
  [
    {
      scope: 'everyJob',
      field: 'conclusion',
      operator: 'is',
      value: 'success',
    },
    { scope: 'value', field: 'event', operator: 'startsWith', value: 'pull' },
    { scope: 'value', field: 'branch', operator: 'endsWith', value: '.x' },
    {
      scope: 'value',
      field: 'workflow',
      operator: 'regex',
      value: '^CI|Deploy$',
    },
  ],
];

const passes = (c: Condition[], doc: unknown) =>
  classify(doc, {
    cell: [
      {
        id: 'x',
        name: 'x',
        color: '#000000',
        summary: 'x',
        outlined: false,
        test: toSchema(c),
      },
    ],
  }) !== undefined;

describe('testForm', () => {
  it.each(conditions)('round-trips %j', (...c) => {
    expect(fromSchema(toSchema(c))).toEqual(c);
  });

  it('matches documents as the conditions say', () => {
    const run = (conclusions: string[], event = 'pull_request') => ({
      workflow: 'Deploy',
      event,
      branch: 'release/2.x',
      jobs: conclusions.map((conclusion) => ({
        name: 'Deploy (Prod)',
        conclusion,
      })),
    });
    const any = conditions[3];
    const every = conditions[4];
    expect(passes(any, run(['failure']))).toBe(true);
    expect(passes(every, run(['success', 'success']))).toBe(true);
    expect(passes(every, run(['success', 'failure']))).toBe(false);
    expect(passes(every, run([]))).toBe(false);
    expect(passes(every, run(['success'], 'push'))).toBe(false);
  });

  it('leaves richer schemas to the JSON view', () => {
    const preset = PRESETS.find((p) => p.id === 'github-deploy-test');
    expect(preset?.cell.map((c) => fromSchema(c.test))).toEqual(
      preset?.cell.map(() => undefined),
    );
    expect(fromSchema({ not: {} })).toBeUndefined();
    expect(fromSchema([])).toBeUndefined();
  });
});
