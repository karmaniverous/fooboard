/**
 * Tests for a dashboard's dismissed unmapped-run patterns (spec 0.2.0
 * §3.I): integrity refuses a dismissal that sets no field, a repeated id
 * and an empty `where`, `workflow` or `branch`, each issue at its path in
 * the configuration; a dashboard without the field gets none; an unknown
 * reason is refused.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { DashboardSchema } from './dashboard';
import { ConfigRootSchema, CURRENT_SCHEMA_VERSION } from './root';
import type { UnmappedDismissal } from './unmappedDismissals';

const BASE = { id: 'board', name: 'Board' };

/** The issues validating a configuration with one dashboard holding
 * `dismissals`, as dotted paths with their messages. */
function issues(dismissals: unknown[]): string[] {
  const parsed = ConfigRootSchema.safeParse({
    schemaVersion: CURRENT_SCHEMA_VERSION,
    dashboards: [{ ...BASE, unmappedDismissals: dismissals }],
  });
  if (parsed.success) return [];
  return parsed.error.issues.map((issue) =>
    issue.path
      .map((p, i) =>
        typeof p === 'number' ? `[${String(p)}]` : i ? `.${String(p)}` : p,
      )
      .join(''),
  );
}

const ok: UnmappedDismissal = { id: 'a', workflow: 'Nightly' };

describe('unmapped dismissals', () => {
  it('defaults to none', () => {
    expect(DashboardSchema.parse(BASE).unmappedDismissals).toEqual([]);
  });

  it('accepts dismissals that each set a field, with distinct ids', () => {
    expect(
      issues([
        ok,
        { id: 'b', where: 'acme/api', branch: 'feature/*' },
        { id: 'c', reason: 'no-order-key' },
      ]),
    ).toEqual([]);
  });

  it('refuses a repeated id, at its path', () => {
    expect(issues([ok, { ...ok }])).toEqual([
      'dashboards[0].unmappedDismissals[1].id',
    ]);
  });

  it('refuses a dismissal that sets no field, at its path', () => {
    expect(issues([ok, { id: 'b' }])).toEqual([
      'dashboards[0].unmappedDismissals[1]',
    ]);
  });

  it.each(['where', 'workflow', 'branch'])('refuses an empty %s', (field) => {
    expect(
      issues([{ id: 'b', reason: 'no-row-matches', [field]: '' }]),
    ).toEqual([`dashboards[0].unmappedDismissals[0].${field}`]);
  });

  it('refuses a reason that isn’t one', () => {
    expect(issues([{ id: 'b', reason: 'no-reason' }])).toEqual([
      'dashboards[0].unmappedDismissals[0].reason',
    ]);
  });
});
