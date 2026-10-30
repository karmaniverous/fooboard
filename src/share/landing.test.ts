/**
 * Tests for where an import lands (spec 0.2.0 §3.J *Keys on arrival*):
 * one dashboard opens its board, asking for the first credential, by
 * name, that has no secret here; none missing, the board alone; several
 * dashboards, the home page.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { DashboardSchema } from '@/domain/config/dashboard';

import { landingAfter } from './landing';

/** A dashboard with credentials labelled, in stored order, `labels`. */
const board = (id: string, labels: string[]) =>
  DashboardSchema.parse({
    id,
    name: id,
    credentials: labels.map((label) => ({
      id: `c-${label}`,
      kind: 'github',
      label,
    })),
  });

const plan = (imported: string[]) => ({
  dashboards: [board('a', ['zeta', 'Alpha', 'beta']), board('b', ['x'])],
  imported,
});

describe('landingAfter', () => {
  it('opens one dashboard on the first credential by name with no secret here', () => {
    expect(landingAfter(plan(['a']), () => false)).toEqual({
      path: '/d/a',
      state: { openCredential: 'c-Alpha' },
    });
  });

  it('skips a credential whose secret is here', () => {
    expect(landingAfter(plan(['a']), (id) => id === 'c-Alpha')).toEqual({
      path: '/d/a',
      state: { openCredential: 'c-beta' },
    });
  });

  it('opens the board alone when every secret is here', () => {
    expect(landingAfter(plan(['a']), () => true)).toEqual({ path: '/d/a' });
  });

  it('opens the board alone when it has no credentials', () => {
    expect(
      landingAfter(
        { dashboards: [board('c', [])], imported: ['c'] },
        () => false,
      ),
    ).toEqual({ path: '/d/c' });
  });

  it('opens the home page after several dashboards, or none', () => {
    expect(landingAfter(plan(['a', 'b']), () => false)).toEqual({ path: '/' });
    expect(landingAfter(plan([]), () => false)).toEqual({ path: '/' });
  });
});
