/**
 * Tests for *Pin* and *Unpin* from a problem (spec.md §3.12): pinning
 * adds the app to its Amplify row once, unpinning removes exactly that
 * pin (key included), a row without a repo keeps its last pin, and other
 * rows are untouched.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { type Dashboard, DashboardSchema } from '@/domain/config/dashboard';
import type { AmplifyRow } from '@/domain/config/row';

import { changePins, samePin } from './pins';

const keyed = { region: 'us-east-1', appId: 'd1', credentialId: 'aws' };
const unkeyed = { region: 'us-east-1', appId: 'd1' };

const board = (rows: Partial<AmplifyRow>[]): Dashboard =>
  DashboardSchema.parse({
    id: 'd',
    name: 'D',
    credentials: [{ id: 'aws', kind: 'aws', label: 'aws' }],
    rows: rows.map((r, i) => ({
      type: 'amplify',
      id: `r${String(i)}`,
      displayName: `r${String(i)}`,
      ...r,
    })),
  });

const pinsOf = (d: Dashboard, id = 'r0') => {
  const row = d.rows.find((r) => r.id === id);
  return row?.type === 'amplify' ? row.pinnedApps : undefined;
};

describe('changePins', () => {
  it('pins an app once', () => {
    const d = board([{ repo: 'acme/web' }, { repo: 'acme/api' }]);
    const once = changePins(d, { kind: 'pin', rowId: 'r0', pin: keyed });
    expect(pinsOf(once)).toEqual([keyed]);
    expect(pinsOf(once, 'r1')).toEqual([]);
    const twice = changePins(once, { kind: 'pin', rowId: 'r0', pin: keyed });
    expect(pinsOf(twice)).toEqual([keyed]);
    // The same app under no key is another pin.
    expect(
      pinsOf(changePins(once, { kind: 'pin', rowId: 'r0', pin: unkeyed })),
    ).toEqual([keyed, unkeyed]);
  });

  it('unpins exactly that pin', () => {
    const d = board([{ repo: 'acme/web', pinnedApps: [keyed, unkeyed] }]);
    expect(
      pinsOf(changePins(d, { kind: 'unpin', rowId: 'r0', pin: unkeyed })),
    ).toEqual([keyed]);
  });

  it("keeps a repo-less row's last pin", () => {
    const d = board([{ pinnedApps: [unkeyed] }]);
    expect(
      pinsOf(changePins(d, { kind: 'unpin', rowId: 'r0', pin: unkeyed })),
    ).toEqual([unkeyed]);
    const withRepo = board([{ repo: 'acme/web', pinnedApps: [unkeyed] }]);
    expect(
      pinsOf(
        changePins(withRepo, { kind: 'unpin', rowId: 'r0', pin: unkeyed }),
      ),
    ).toEqual([]);
  });

  it('leaves a GitHub row with the id alone', () => {
    const d = DashboardSchema.parse({
      id: 'd',
      name: 'D',
      rows: [{ type: 'github', id: 'r0', displayName: 'r0', repo: 'a/b' }],
    });
    expect(changePins(d, { kind: 'pin', rowId: 'r0', pin: keyed })).toEqual(d);
  });

  it('compares pins by region, app and key', () => {
    expect(samePin(keyed, { ...keyed })).toBe(true);
    expect(samePin(keyed, unkeyed)).toBe(false);
    expect(samePin(keyed, { ...keyed, region: 'eu-west-1' })).toBe(false);
    expect(samePin(keyed, { ...keyed, appId: 'd2' })).toBe(false);
  });
});
