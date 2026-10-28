/**
 * Tests for share links (spec.md §3.8): the envelope compressed into the
 * `#b=` fragment at the app's home; opening one clears the fragment with
 * `history.replaceState` before the payload is even decompressed; a
 * payload that won't decompress is damaged, and cleared all the same; any
 * other URL is left alone.
 *
 * @module
 */
import LZString from 'lz-string';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { windowAt } from '@/test/linkWindow';
import { shareBoard } from '@/test/shareBoard';

import { buildEnvelope } from './envelope';
import { SHARE_LINK_PREFIX, shareLink, takeShareLink } from './link';

const decompress = vi.spyOn(LZString, 'decompressFromEncodedURIComponent');
afterEach(() => {
  decompress.mockClear();
});

const envelope = buildEnvelope([shareBoard()], null);

describe('share links', () => {
  it('puts the compressed envelope in the fragment at the home page', () => {
    const link = shareLink(envelope, 'https://fooboard.dev');
    expect(SHARE_LINK_PREFIX).toBe('#b=');
    expect(link.startsWith('https://fooboard.dev/#b=')).toBe(true);
    expect(link).not.toContain('northwind');
    const win = windowAt(link);
    expect(takeShareLink(win, '/')).toEqual({
      kind: 'text',
      text: JSON.stringify(envelope),
    });
  });

  it('clears the fragment before anything else, keeping the history state', () => {
    const win = windowAt(
      shareLink(envelope, 'https://fooboard.dev').replace('/#', '/d/x#'),
    );
    takeShareLink(win, '/');
    expect(win.url.toString()).toBe('https://fooboard.dev/');
    expect(win.history.replaceState).toHaveBeenCalledWith({ idx: 0 }, '', '/');
    const [cleared] = vi.mocked(win.history.replaceState).mock
      .invocationCallOrder;
    const [decompressed] = decompress.mock.invocationCallOrder;
    expect(cleared).toBeLessThan(decompressed);
  });

  it('calls a payload that will not decompress damaged, and clears it', () => {
    const win = windowAt('https://fooboard.dev/#b=%E2%98%83');
    expect(takeShareLink(win, '/')).toEqual({ kind: 'damaged' });
    expect(win.url.hash).toBe('');
    decompress.mockImplementationOnce(() => {
      throw new Error('bad input');
    });
    const thrown = windowAt('https://fooboard.dev/#b=abc');
    expect(takeShareLink(thrown, '/')).toEqual({ kind: 'damaged' });
    expect(thrown.url.hash).toBe('');
  });

  it.each(['', '#', '#c=abc', '#B=abc', '#section'])(
    'leaves a URL with fragment %j alone',
    (hash) => {
      const win = windowAt(`https://fooboard.dev/demo${hash}`);
      expect(takeShareLink(win, '/')).toBeNull();
      expect(win.history.replaceState).not.toHaveBeenCalled();
    },
  );
});
