/**
 * Tests for where the import dialog's share comes from: a file whose
 * text can't be read is refused as a damaged file, a file input
 * cleared without a file reads nothing, and pasted text is a share when
 * it is JSON and a link otherwise.
 *
 * @module
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PASTE_LABEL, ShareInputs } from './ShareInputs';
import { refusalHint } from './shareWords';

const fileInput = () => screen.getByLabelText('A fooboard file');

describe('ShareInputs', () => {
  it('refuses a file whose text cannot be read as damaged', async () => {
    const onRead = vi.fn();
    render(<ShareInputs onRead={onRead} />);
    const unreadable = new File(['x'], 'board.json');
    unreadable.text = () => Promise.reject(new Error('gone'));
    await act(async () => {
      fireEvent.change(fileInput(), { target: { files: [unreadable] } });
      await Promise.resolve();
    });
    expect(onRead).toHaveBeenCalledWith(
      { ok: false, reason: 'damaged', issues: [] },
      'file',
    );
  });

  it.each([
    ['JSON', '{"format":1}', 'share'],
    ['a link', 'https://www.fooboard.dev/#j=%7B', 'link'],
    ['nothing', '  ', 'link'],
  ])('names pasted %s (%j) a %s', (_what, text, origin) => {
    const onRead = vi.fn();
    render(<ShareInputs onRead={onRead} />);
    fireEvent.change(screen.getByLabelText(PASTE_LABEL), {
      target: { value: text },
    });
    expect(onRead.mock.lastCall?.[1]).toBe(origin);
  });

  it('asks for a new one of pasted JSON, never a link', () => {
    expect(refusalHint('share')).not.toMatch(/link|file/);
  });

  it('reads nothing when the file input is cleared', () => {
    const onRead = vi.fn();
    render(<ShareInputs onRead={onRead} />);
    fireEvent.change(fileInput(), { target: { files: [] } });
    expect(onRead).not.toHaveBeenCalled();
  });
});
