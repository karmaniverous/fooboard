/**
 * Tests for `MappingSettingsSchema`: the workflow filter tests workflow
 * names only.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { MappingSettingsSchema } from './mappingSettings';

const test = (field: string) => ({ field, operator: 'is', value: 'x' });

describe('MappingSettingsSchema', () => {
  it('rejects a workflow filter test on job name', () => {
    const parsed = MappingSettingsSchema.safeParse({
      workflowFilter: { include: [test('jobName')] },
    });
    expect(parsed.success).toBe(false);
  });

  it('accepts one on workflow name', () => {
    expect(
      MappingSettingsSchema.safeParse({
        workflowFilter: { include: [test('workflowName')] },
      }).success,
    ).toBe(true);
  });
});
