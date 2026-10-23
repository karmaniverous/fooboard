/**
 * Test helpers for collapsible list items (`CollapsibleItem`): an open
 * state for an item's editor rendered on its own (its list owns the open
 * state in the app), and opening an item by its name as a user does.
 *
 * @module
 */
import { fireEvent, screen } from '@testing-library/react';

import type { ItemOpenState } from '@/components/CollapsibleItem';

export const OPEN_ITEM: ItemOpenState = {
  open: true,
  onOpenChange: () => undefined,
};

/** Characters with a meaning in a regular expression. */
const REGEX_SPECIALS = /[.*+?^${}()|[\]\\]/g;

/** The header trigger of the item named `name` (its name, then its
 * summary, if any). */
export const itemTrigger = (name: string): HTMLElement =>
  screen.getByRole('button', {
    name: new RegExp(`^${name.replace(REGEX_SPECIALS, '\\$&')}( |$)`),
  });

/** Is the item named `name` open? */
export const isOpen = (name: string): boolean =>
  itemTrigger(name).getAttribute('aria-expanded') === 'true';

/** Open the item named `name`, unless it is open already. */
export function expand(name: string): void {
  if (!isOpen(name)) fireEvent.click(itemTrigger(name));
}
