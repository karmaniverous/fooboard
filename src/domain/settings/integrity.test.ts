/**
 * Tests for the settings a row or cell may not hold (spec.md §3.11
 * *Fallbacks*): another source's per-source setting, or an AWS key on a
 * GitHub row, rejected by the dashboard schema at its path.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { DashboardSchema } from '@/domain/config/dashboard';

describe('rowSettingsIssues', () => {
  it.each([
    [
      "the other source's status set",
      { settings: { statusSets: { amplify: 'amplify' } } },
      ['rows', 0, 'settings', 'statusSets', 'amplify'],
      'a github row cannot set the amplify status set',
    ],
    [
      "the other source's item rule, in a cell",
      { cellSettings: { dev: { itemRules: { amplify: { checks: [] } } } } },
      ['rows', 0, 'cellSettings', 'dev', 'itemRules', 'amplify'],
      'a github row cannot set the amplify item rule',
    ],
    [
      'an AWS key',
      { settings: { awsKey: 'aws' } },
      ['rows', 0, 'settings', 'awsKey'],
      'a GitHub row reads no AWS key',
    ],
  ])('rejects %s on a GitHub row', (_label, extra, path, message) => {
    const parsed = DashboardSchema.safeParse({
      id: 'd1',
      name: 'Dashboard 1',
      credentials: [{ id: 'aws', kind: 'aws', label: 'aws' }],
      stages: [{ id: 'dev', name: 'dev' }],
      rows: [
        { type: 'github', id: 'r', repo: 'acme/r', displayName: 'r', ...extra },
      ],
    });
    expect(parsed.error?.issues).toEqual([
      expect.objectContaining({ path, message }),
    ]);
  });
});
