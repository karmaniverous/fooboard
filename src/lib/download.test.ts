/**
 * Tests for saving JSON as a download: a named JSON file, whose object
 * URL is let go only after the click.
 *
 * @module
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { download } from './download';

describe('download', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('saves the text as a named file, then lets the URL go', async () => {
    vi.useFakeTimers();
    const create = vi.fn((blob: Blob) => {
      expect(blob.type).toBe('application/json');
      return 'blob:share';
    });
    const revoke = vi.fn();
    vi.stubGlobal(
      'URL',
      Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke }),
    );
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        expect(this.download).toBe('f.json');
        expect(this.href).toBe('blob:share');
      });
    download('{}', 'f.json');
    expect(click).toHaveBeenCalledOnce();
    expect(revoke).not.toHaveBeenCalled();
    await vi.runAllTimersAsync();
    expect(revoke).toHaveBeenCalledWith('blob:share');
    click.mockRestore();
  });
});
