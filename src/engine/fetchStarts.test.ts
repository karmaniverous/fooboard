/**
 * Tests for tracking fetch starts (spec.md §3.1, Decision 47): a fetch's
 * start is kept through pausing and resuming, and one call comes once it
 * has run longer than the refreshing delay; a fetch that lands, or whose
 * query is removed, first is forgotten with its timer; a fetch already
 * under way counts from when tracking begins; `destroy` clears every
 * timer and stops listening.
 *
 * @module
 */
import { type FetchStatus, QueryClient } from '@tanstack/query-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createFetchStarts } from './fetchStarts';
import { REFRESHING_DELAY_MS } from './refreshing';

/** A client whose queries are never garbage collected (no timers). */
const newClient = () =>
  new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
const build = (client: QueryClient, name: string) =>
  client.getQueryCache().build(client, { queryKey: [name] });
const setFetch = (
  query: ReturnType<typeof build>,
  fetchStatus: FetchStatus,
) => {
  query.setState({ ...query.state, fetchStatus });
};

function track(client: QueryClient) {
  const onSlow = vi.fn<(queryHash: string) => void>();
  const starts = createFetchStarts({
    cache: client.getQueryCache(),
    now: Date.now,
    onSlow,
  });
  return { onSlow, starts };
}

describe('createFetchStarts', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps a fetch’s start through a pause and calls once past the delay', () => {
    const client = newClient();
    const query = build(client, 'runs');
    const { onSlow, starts } = track(client);
    const startedAt = Date.now();
    setFetch(query, 'fetching');
    expect(starts.startedAt(query.queryHash)).toBe(startedAt);
    vi.advanceTimersByTime(REFRESHING_DELAY_MS / 2);
    setFetch(query, 'paused');
    setFetch(query, 'fetching');
    expect(starts.startedAt(query.queryHash)).toBe(startedAt);
    vi.advanceTimersByTime(REFRESHING_DELAY_MS / 2);
    expect(onSlow).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onSlow).toHaveBeenCalledExactlyOnceWith(query.queryHash);
    vi.advanceTimersByTime(REFRESHING_DELAY_MS * 2);
    expect(onSlow).toHaveBeenCalledOnce();
  });

  it('forgets a fetch that lands, or whose query is removed, before the delay', () => {
    const client = newClient();
    const landed = build(client, 'landed');
    const removed = build(client, 'removed');
    const { onSlow, starts } = track(client);
    setFetch(landed, 'fetching');
    setFetch(removed, 'fetching');
    expect(vi.getTimerCount()).toBe(2);
    setFetch(landed, 'idle');
    client.getQueryCache().remove(removed);
    expect(vi.getTimerCount()).toBe(0);
    expect(starts.startedAt(landed.queryHash)).toBeUndefined();
    expect(starts.startedAt(removed.queryHash)).toBeUndefined();
    vi.advanceTimersByTime(REFRESHING_DELAY_MS * 2);
    expect(onSlow).not.toHaveBeenCalled();
  });

  it('counts a fetch already under way from when tracking begins', () => {
    const client = newClient();
    const query = build(client, 'runs');
    setFetch(query, 'fetching');
    vi.advanceTimersByTime(REFRESHING_DELAY_MS);
    const { onSlow, starts } = track(client);
    expect(starts.startedAt(query.queryHash)).toBe(Date.now());
    vi.advanceTimersByTime(REFRESHING_DELAY_MS + 1);
    expect(onSlow).toHaveBeenCalledExactlyOnceWith(query.queryHash);
  });

  it('clears every timer on destroy and stops listening', () => {
    const client = newClient();
    const first = build(client, 'first');
    const later = build(client, 'later');
    const { onSlow, starts } = track(client);
    setFetch(first, 'fetching');
    starts.destroy();
    expect(vi.getTimerCount()).toBe(0);
    setFetch(later, 'fetching');
    expect(starts.startedAt(later.queryHash)).toBeUndefined();
    vi.advanceTimersByTime(REFRESHING_DELAY_MS * 2);
    expect(onSlow).not.toHaveBeenCalled();
  });
});
