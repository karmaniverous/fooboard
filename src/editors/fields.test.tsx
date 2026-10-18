/**
 * Tests for `CommitInput`: commits a trimmed, changed value on blur or
 * Enter; a required field reverts when emptied, an optional one clears;
 * and it follows the saved value when that changes underneath.
 *
 * @module
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CommitInput } from './fields';

const field = () => screen.getByLabelText('Name');

describe('CommitInput', () => {
  it('commits a trimmed change on Enter, and nothing when unchanged', () => {
    const onCommit = vi.fn();
    render(<CommitInput label="Name" value="api" onCommit={onCommit} />);
    fireEvent.blur(field());
    fireEvent.change(field(), { target: { value: ' core ' } });
    fireEvent.keyDown(field(), { key: 'Enter' });
    expect(onCommit.mock.calls).toEqual([['core']]);
  });

  it('reverts an emptied required field; clears an optional one', () => {
    const required = vi.fn();
    const { rerender } = render(
      <CommitInput label="Name" value="api" onCommit={required} />,
    );
    fireEvent.change(field(), { target: { value: '  ' } });
    fireEvent.blur(field());
    expect(required).not.toHaveBeenCalled();
    expect(field()).toHaveValue('api');

    const optional = vi.fn();
    rerender(
      <CommitInput optional label="Name" value="api" onCommit={optional} />,
    );
    fireEvent.change(field(), { target: { value: '' } });
    fireEvent.blur(field());
    expect(optional).toHaveBeenCalledWith('');
  });

  it('follows the saved value when it changes underneath', () => {
    const { rerender } = render(
      <CommitInput label="Name" value="api" onCommit={vi.fn()} />,
    );
    fireEvent.change(field(), { target: { value: 'draft' } });
    rerender(<CommitInput label="Name" value="web" onCommit={vi.fn()} />);
    expect(field()).toHaveValue('web');
  });
});
