/**
 * Tests for ReorderList's dragging (spec.md C-14, C-21): a keyboard
 * reorder through dnd-kit's keyboard sensor reports the dragged item and
 * the one it lands on; while dragging, the overlay carries the item's
 * collapsed header and the item itself stays in place, dimmed, as the
 * placeholder; the move buttons still step items.
 *
 * @module
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { keyboardDrag, startKeyboardDrag } from '@/test/keyboardDrag';

import { ReorderList } from './ReorderList';

interface Item {
  id: string;
  repo: string;
}
const ITEMS: Item[] = [
  { id: 'api', repo: 'acme/api' },
  { id: 'web', repo: 'acme/web' },
  { id: 'jobs', repo: 'acme/jobs' },
];

function renderList(
  onStep: (item: Item, delta: -1 | 1) => (() => void) | undefined = () =>
    undefined,
) {
  const onDrop = vi.fn<(from: Item, to: Item) => void>();
  render(
    <ReorderList
      items={ITEMS}
      keyOf={(i) => i.id}
      nameOf={(i) => i.id}
      summaryOf={(i) => i.repo}
      onRemove={() => undefined}
      onDrop={onDrop}
      onStep={onStep}
    >
      {(i) => <input aria-label={`Field of ${i.id}`} />}
    </ReorderList>,
  );
  return onDrop;
}

const handle = (name: string) =>
  screen.getByRole('button', { name: `Drag ${name} to reorder` });

describe('ReorderList dragging', () => {
  it('reorders from the keyboard, reporting the item and where it lands', async () => {
    const onDrop = renderList();
    await keyboardDrag(handle('api'), 2);
    expect(onDrop).toHaveBeenCalledExactlyOnceWith(ITEMS[0], ITEMS[2]);
  });

  it('reports nothing when the item is put back where it was', async () => {
    const onDrop = renderList();
    await keyboardDrag(handle('web'), 0);
    expect(onDrop).not.toHaveBeenCalled();
  });

  it('carries the collapsed header and dims the item left in place', async () => {
    renderList();
    const drag = await startKeyboardDrag(handle('web'));
    const placeholder = handle('web').closest('li');
    expect(placeholder).toHaveAttribute('data-dragging', 'true');
    expect(placeholder).toHaveClass('opacity-50');
    // The overlay: the header's name and summary, outside the list and
    // without its buttons or fields.
    const copies = screen.getAllByText('acme/web');
    const overlay = copies.find((el) => !el.closest('li'));
    expect(overlay?.parentElement).toHaveTextContent('web acme/web');
    expect(overlay?.parentElement?.querySelector('button')).toBeNull();
    await drag.drop();
    expect(handle('web').closest('li')).not.toHaveClass('opacity-50');
  });

  it('keeps the move buttons', () => {
    const steps: string[] = [];
    renderList((item, delta) =>
      item.id === 'jobs' && delta === 1
        ? undefined
        : () => {
            steps.push(`${item.id} ${String(delta)}`);
          },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Move web up' }));
    fireEvent.click(screen.getByRole('button', { name: 'Move api down' }));
    expect(steps).toEqual(['web -1', 'api 1']);
    expect(
      screen.getByRole('button', { name: 'Move jobs down' }),
    ).toBeDisabled();
  });

  it('leaves the fields clickable: only the handle starts a drag', () => {
    renderList();
    fireEvent.click(screen.getByRole('button', { name: /^api/ }));
    const field = screen.getByLabelText('Field of api');
    fireEvent.pointerDown(field);
    expect(document.querySelector('[data-dragging]')).toBeNull();
  });
});
