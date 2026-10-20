/**
 * Tests for CheckField: the label names the checkbox, and a click reports
 * the new state as a plain boolean.
 *
 * @module
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CheckField } from './CheckField';

describe('CheckField', () => {
  it.each([
    [false, true],
    [true, false],
  ])('checked %s reports %s when its label is clicked', (checked, next) => {
    const onCheckedChange = vi.fn();
    render(
      <CheckField
        label="Outlined"
        checked={checked}
        onCheckedChange={onCheckedChange}
      />,
    );
    const box = screen.getByRole('checkbox', { name: 'Outlined' });
    expect(box).toHaveAttribute('aria-checked', String(checked));
    fireEvent.click(screen.getByText('Outlined'));
    expect(onCheckedChange).toHaveBeenCalledWith(next);
  });
});
