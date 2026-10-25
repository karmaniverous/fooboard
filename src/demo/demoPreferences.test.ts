/**
 * The demo's preferences (spec.md §3.14 *Board and edits*): view settings
 * are saved on the device like any board's; problem dismissals stay in
 * memory for the visit and never reach the device.
 */
import { describe, expect, it } from 'vitest';

import { memoryStorage } from '@/storage/keyValue';
import {
  createPreferencesStore,
  DEVICE_PREFERENCES_KEY,
} from '@/storage/preferencesStore';

import { demoPreferences } from './demoPreferences';

describe('demo preferences', () => {
  it('saves view settings on the device but keeps dismissals for the visit', () => {
    const storage = memoryStorage();
    const device = createPreferencesStore(storage);
    const visit = demoPreferences(device);
    visit.setView('demo', { dismissedProblems: ['p1'] });
    expect(visit.getView('demo').dismissedProblems).toEqual(['p1']);
    expect(device.getView('demo').dismissedProblems).toEqual([]);
    expect(storage.getItem(DEVICE_PREFERENCES_KEY) ?? '').not.toContain('p1');
    // A view setting changed in the demo is saved, the dismissal kept.
    const zoomed = visit.setView('demo', { zoom: 1.2 });
    expect(zoomed).toMatchObject({ zoom: 1.2, dismissedProblems: ['p1'] });
    expect(device.getView('demo').zoom).toBe(1.2);
    // The next visit starts with nothing dismissed.
    expect(demoPreferences(device).getView('demo').dismissedProblems).toEqual(
      [],
    );
  });
});
