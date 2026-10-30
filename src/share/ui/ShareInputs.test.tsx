/**
 * Tests for where the import dialog's share comes from: a file whose
 * text can't be read is refused as a damaged file, and a file input
 * cleared without a file reads nothing.
 *
 * @module
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ShareInputs } from './ShareInputs';

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

  it('reads nothing when the file input is cleared', () => {
    const onRead = vi.fn();
    render(<ShareInputs onRead={onRead} />);
    fireEvent.change(fileInput(), { target: { files: [] } });
    expect(onRead).not.toHaveBeenCalled();
  });
});
