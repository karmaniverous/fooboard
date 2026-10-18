/**
 * Tests for Choice (the library's Select): it shows the chosen option,
 * offers every option, and passes an empty-string value through both ways
 * (Radix reserves the empty string).
 *
 * @module
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { choose, optionsOf } from '@/test/choose';

import { Choice } from './Choice';

const options = [
  { value: '', label: 'No group' },
  { value: 'g', label: 'Group: Backend' },
];

describe('Choice', () => {
  it('shows the chosen option and offers every option', () => {
    render(
      <Choice
        label="Group"
        value=""
        options={options}
        onValueChange={vi.fn()}
      />,
    );
    const trigger = screen.getByRole('combobox', { name: 'Group' });
    expect(trigger).toHaveTextContent('No group');
    expect(optionsOf(trigger)).toEqual(['No group', 'Group: Backend']);
  });

  it('passes an empty-string value through both ways', () => {
    const onValueChange = vi.fn();
    const { rerender } = render(
      <Choice
        label="Group"
        value=""
        options={options}
        onValueChange={onValueChange}
      />,
    );
    choose(screen.getByRole('combobox', { name: 'Group' }), 'Group: Backend');
    expect(onValueChange).toHaveBeenLastCalledWith('g');
    rerender(
      <Choice
        label="Group"
        value="g"
        options={options}
        onValueChange={onValueChange}
      />,
    );
    choose(screen.getByRole('combobox', { name: 'Group' }), 'No group');
    expect(onValueChange).toHaveBeenLastCalledWith('');
  });

  it('offers a disabled option but does not choose it', () => {
    const onValueChange = vi.fn();
    render(
      <Choice
        label="Group"
        value=""
        options={[...options, { value: 'x', label: 'Retired', disabled: true }]}
        onValueChange={onValueChange}
      />,
    );
    const trigger = screen.getByRole('combobox', { name: 'Group' });
    fireEvent.keyDown(trigger, { key: 'Enter' });
    const retired = screen.getByRole('option', { name: 'Retired' });
    expect(retired).toHaveAttribute('aria-disabled', 'true');
    fireEvent.keyDown(retired, { key: 'Enter' });
    expect(onValueChange).not.toHaveBeenCalled();
  });
});
