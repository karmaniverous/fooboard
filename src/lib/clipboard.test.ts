/**
 * Tests for copyText: true when the browser copies, false (never a throw)
 * when there is no clipboard (an insecure page), when the write is refused
 * or when it throws outright.
 *
 * @module
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { copyText } from './clipboard';

const setClipboard = (clipboard: unknown) => {
  Object.defineProperty(navigator, 'clipboard', {
    value: clipboard,
    configurable: true,
  });
};

afterEach(() => {
  Reflect.deleteProperty(navigator, 'clipboard');
});

describe('copyText', () => {
  it('copies the text and reports success', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    setClipboard({ writeText });
    await expect(copyText('hello')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('hello');
  });

  it.each([
    ['there is no clipboard', undefined],
    [
      'the write is refused',
      { writeText: () => Promise.reject(new Error('denied')) },
    ],
    [
      'the write throws',
      {
        writeText: () => {
          throw new Error('boom');
        },
      },
    ],
  ])('reports failure when %s', async (_, clipboard) => {
    setClipboard(clipboard);
    await expect(copyText('hello')).resolves.toBe(false);
  });
});
