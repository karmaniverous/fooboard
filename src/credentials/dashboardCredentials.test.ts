/**
 * Tests for dashboard credential changes: the first credential of a kind
 * becomes the default, and removing one leaves a valid dashboard with no
 * dangling references.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { DashboardSchema } from '@/domain/config/dashboard';

import {
  addCredential,
  removeCredential,
  setDefaultCredential,
} from './dashboardCredentials';

const base = DashboardSchema.parse({ id: 'd', name: 'D' });
const gh = (id: string) => ({ id, kind: 'github' as const, label: id });

describe('dashboard credentials', () => {
  it('makes the first credential of a kind the default', () => {
    const one = addCredential(base, gh('a'));
    const two = addCredential(one, gh('b'));
    expect(two.defaultCredentials.github).toBe('a');
    expect(
      setDefaultCredential(two, 'github', 'b').defaultCredentials.github,
    ).toBe('b');
  });

  it('removes a credential and every reference to it', () => {
    let d = addCredential(base, gh('a'));
    d = addCredential(d, { id: 'k', kind: 'aws', label: 'k' });
    d = {
      ...d,
      rows: [
        {
          type: 'github',
          id: 'r1',
          repo: 'o/r',
          displayName: 'r',
          credentialId: 'a',
          stageRules: {},
          cellStatusSets: {},
        },
        {
          type: 'amplify',
          id: 'r2',
          repo: 'o/s',
          displayName: 's',
          githubCredentialId: 'a',
          sources: [{ credentialId: 'k', region: 'us-east-1', appId: 'x' }],
          stageRules: {},
          cellStatusSets: {},
        },
      ],
    };
    const removed = removeCredential(removeCredential(d, 'a'), 'k');
    expect(() => DashboardSchema.parse(removed)).not.toThrow();
    expect(removed.credentials).toEqual([]);
    expect(JSON.stringify(removed)).not.toMatch(/"(a|k)"/);
  });
});
