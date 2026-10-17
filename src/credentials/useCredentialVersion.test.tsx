/**
 * Tests for useCredentialVersion: every secret change bumps the version,
 * and unmounting unsubscribes.
 *
 * @module
 */
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { createAppStores } from '@/storage';
import { memoryStorage } from '@/storage/keyValue';
import { StoresContext } from '@/storage/storesContext';

import { useCredentialVersion } from './useCredentialVersion';

describe('useCredentialVersion', () => {
  it('changes on each secret change and stops listening on unmount', () => {
    const stores = createAppStores(memoryStorage());
    const unsubscribed = vi.fn();
    const { credentials } = stores;
    const subscribe = credentials.subscribe.bind(credentials);
    credentials.subscribe = (listener) => {
      const off = subscribe(listener);
      return () => {
        unsubscribed();
        off();
      };
    };
    const { result, unmount } = renderHook(() => useCredentialVersion(), {
      wrapper: ({ children }) => (
        <StoresContext value={stores}>{children}</StoresContext>
      ),
    });
    const start = result.current;
    act(() => {
      stores.credentials.set('a', { kind: 'github', token: '***' }, false);
    });
    expect(result.current).toBe(start + 1);
    act(() => {
      stores.credentials.forget('a');
    });
    expect(result.current).toBe(start + 2);

    unmount();
    expect(unsubscribed).toHaveBeenCalledTimes(1);
  });
});
