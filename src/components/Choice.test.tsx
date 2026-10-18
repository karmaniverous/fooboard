/**
 * Tests for Choice (the library's Select): it shows the chosen option,
 * offers every option, and passes an empty-string value through both ways
 * (Radix reserves the empty string).
 *
 * @module
 */
import { render, screen } from '@testing-library/react';
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
});
