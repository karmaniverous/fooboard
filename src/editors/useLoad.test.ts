/**
 * Tests for useLoad's newer-wins rule: an older request settling after a
 * newer one (either way) never replaces the newer result, and a load
 * after a failure recovers.
 *
 * @module
 */
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useLoad } from './useLoad';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('useLoad', () => {
  it('ignores an older request that resolves after a newer one', async () => {
    const { result } = renderHook(() => useLoad<string>());
    const older = deferred<string>();
    const newer = deferred<string>();
    act(() => {
      result.current[1](() => older.promise);
    });
    act(() => {
      result.current[1](() => newer.promise);
    });
    await act(async () => {
      newer.resolve('new');
      await newer.promise;
    });
    await act(async () => {
      older.resolve('old');
      await older.promise;
    });
    expect(result.current[0]).toEqual({ kind: 'done', value: 'new' });
  });

  it('ignores an older request that fails after a newer one', async () => {
    const { result } = renderHook(() => useLoad<string>());
    const older = deferred<string>();
    act(() => {
      result.current[1](() => older.promise);
    });
    await act(async () => {
      result.current[1](() => Promise.resolve('new'));
      await Promise.resolve();
    });
    await act(async () => {
      older.reject(new Error('stale failure'));
      await older.promise.catch(() => undefined);
    });
    expect(result.current[0]).toEqual({ kind: 'done', value: 'new' });
  });

  it('recovers with a new load after a failure', async () => {
    const { result } = renderHook(() => useLoad<string>());
    await act(async () => {
      result.current[1](() => Promise.reject(new Error('offline')));
      await Promise.resolve();
    });
    expect(result.current[0]).toMatchObject({
      kind: 'error',
      message: expect.stringContaining('offline') as unknown,
    });
    await act(async () => {
      result.current[1](() => Promise.resolve('ok'));
      await Promise.resolve();
    });
    expect(result.current[0]).toEqual({ kind: 'done', value: 'ok' });
  });
});
