/**
 * Device preferences version 3 (spec.md §3.10, C-20): the last version
 * whose release notes were seen, with version 2 migrating to it unchanged
 * otherwise.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { memoryStorage } from './keyValue';
import {
  createPreferencesStore,
  DEVICE_PREFERENCES_KEY,
} from './preferencesStore';

describe('the last version seen', () => {
  it('is none at first, then kept on the device', () => {
    const device = memoryStorage();
    expect(createPreferencesStore(device).getLastSeenVersion()).toBeUndefined();
    createPreferencesStore(device).setLastSeenVersion('0.1.0');
    expect(createPreferencesStore(device).getLastSeenVersion()).toBe('0.1.0');
    expect(JSON.parse(device.getItem(DEVICE_PREFERENCES_KEY) ?? '')).toEqual(
      expect.objectContaining({ schemaVersion: 3, lastSeenVersion: '0.1.0' }),
    );
  });

  it('leaves the theme and view settings as they were', () => {
    const store = createPreferencesStore(memoryStorage());
    store.setTheme('dark');
    store.setView('d', { density: 'compact' });
    store.setLastSeenVersion('0.1.0');
    expect(store.getTheme()).toBe('dark');
    expect(store.getView('d').density).toBe('compact');
  });

  it('migrates version 2, keeping everything, with nothing seen', () => {
    const device = memoryStorage();
    device.setItem(
      DEVICE_PREFERENCES_KEY,
      JSON.stringify({
        schemaVersion: 2,
        theme: 'light',
        dashboards: { d: { zoom: 2, density: 'compact', boardSize: '3x4' } },
      }),
    );
    const store = createPreferencesStore(device);
    expect(store.getTheme()).toBe('light');
    expect(store.getView('d')).toEqual({
      zoom: 2,
      density: 'compact',
      boardSize: '3x4',
      dismissedProblems: [],
    });
    expect(store.getLastSeenVersion()).toBeUndefined();
    store.setLastSeenVersion('0.1.0');
    expect(JSON.parse(device.getItem(DEVICE_PREFERENCES_KEY) ?? '')).toEqual({
      schemaVersion: 3,
      theme: 'light',
      dashboards: {
        d: {
          zoom: 2,
          density: 'compact',
          boardSize: '3x4',
          dismissedProblems: [],
        },
      },
      lastSeenVersion: '0.1.0',
    });
  });

  it('starts afresh from a version 2 that is unreadable', () => {
    const device = memoryStorage();
    device.setItem(
      DEVICE_PREFERENCES_KEY,
      JSON.stringify({ schemaVersion: 2, theme: 'sepia', dashboards: {} }),
    );
    expect(createPreferencesStore(device).getTheme()).toBe('system');
  });
});
