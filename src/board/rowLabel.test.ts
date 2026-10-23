/**
 * Tests for a row header's tooltip: the name and repo, or the name alone
 * for an Amplify app without a GitHub repo.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { rowLabel } from './rowLabel';

describe('rowLabel', () => {
  it.each([
    [{ displayName: 'api', repo: 'acme/api' }, 'api (acme/api)'],
    [{ displayName: 'site' }, 'site'],
  ])('labels %j as %s', (row, label) => {
    expect(rowLabel(row)).toBe(label);
  });
});
