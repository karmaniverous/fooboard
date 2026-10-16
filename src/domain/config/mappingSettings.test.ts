/**
 * Tests for `MappingSettingsSchema`: each kind of test is restricted to the
 * field its evaluator can supply, and default tests are never shared
 * between parsed dashboards.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_DEPLOY_PHASE_TESTS,
  DEFAULT_TEST_PHASE_TESTS,
  MappingSettingsSchema,
} from './mappingSettings';
import { createDashboard } from './presets';

const test = (field: string) => ({ field, operator: 'is', value: 'x' });

describe('MappingSettingsSchema fields', () => {
  it('rejects a phase test on workflow name', () => {
    const parsed = MappingSettingsSchema.safeParse({
      phases: { deploy: [test('workflowName')] },
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects a workflow filter test on job name', () => {
    const parsed = MappingSettingsSchema.safeParse({
      workflowFilter: { include: [test('jobName')] },
    });
    expect(parsed.success).toBe(false);
  });
});

describe('MappingSettingsSchema default isolation', () => {
  it.each([
    ['omitted phases', {}],
    ['empty phases', { phases: {} }],
  ])('does not share default tests (%s)', (_label, input) => {
    const a = MappingSettingsSchema.parse(input);
    const b = MappingSettingsSchema.parse(input);
    a.phases.deploy[0].value = 'changed';
    a.phases.test[0].value = 'changed';
    expect(b.phases.deploy[0].value).toBe('deploy');
    expect(b.phases.test[0].value).toBe('test');
    expect(MappingSettingsSchema.parse(input).phases.deploy[0].value).toBe(
      'deploy',
    );
  });

  it('does not share default tests between created dashboards', () => {
    const a = createDashboard('a');
    const b = createDashboard('b');
    a.mapping.phases.test[0].value = 'changed';
    expect(b.mapping.phases.test[0].value).toBe('test');
    expect(DEFAULT_TEST_PHASE_TESTS[0].value).toBe('test');
    expect(DEFAULT_DEPLOY_PHASE_TESTS[0].value).toBe('deploy');
  });
});
