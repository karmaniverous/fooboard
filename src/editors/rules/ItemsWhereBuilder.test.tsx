/**
 * Tests for the *only items where* builder: the chosen key, glob and case
 * become one check; a blank glob adds nothing.
 *
 * @module
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { itemsWhere } from './itemsWhere';
import { ItemsWhereBuilder } from './ItemsWhereBuilder';

const setup = () => {
  const onAdd = vi.fn();
  render(
    <ItemsWhereBuilder label="R" itemKeys={['name', 'state']} onAdd={onAdd} />,
  );
  return {
    onAdd,
    glob: screen.getByLabelText('R item glob'),
    add: screen.getByRole('button', { name: 'Add' }),
  };
};

describe('ItemsWhereBuilder', () => {
  it('adds a case-folded check on the first key by default', () => {
    const { onAdd, glob, add } = setup();
    expect(add).toBeDisabled();
    fireEvent.change(glob, { target: { value: ' deploy* ' } });
    fireEvent.click(add);
    expect(onAdd).toHaveBeenCalledWith(itemsWhere('name', 'deploy*', true));
    expect(glob).toHaveValue('');
  });

  it('uses the chosen key and case', () => {
    const { onAdd, glob, add } = setup();
    fireEvent.change(screen.getByLabelText('R item key'), {
      target: { value: 'state' },
    });
    fireEvent.click(screen.getByLabelText('Ignore case'));
    fireEvent.change(glob, { target: { value: 'failed' } });
    fireEvent.click(add);
    expect(onAdd).toHaveBeenCalledWith(itemsWhere('state', 'failed', false));
  });
});
