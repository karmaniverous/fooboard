/**
 * Test helpers for the library's Select (`Choice`): open it from the
 * keyboard, as a user can, then read or pick its options by their text.
 *
 * @module
 */
import { fireEvent, screen } from '@testing-library/react';

const open = (trigger: HTMLElement) => {
  fireEvent.keyDown(trigger, { key: 'Enter' });
  return screen.getAllByRole('option');
};

/** The option labels of a select, in order (closing it again). */
export function optionsOf(trigger: HTMLElement): string[] {
  const options = open(trigger);
  const labels = options.map((o) => o.textContent);
  fireEvent.keyDown(options[0] ?? trigger, { key: 'Escape' });
  return labels;
}

/** Pick the option whose label is `label`. */
export function choose(trigger: HTMLElement, label: string): void {
  const option = open(trigger).find((o) => o.textContent === label);
  if (!option) throw new Error(`no option "${label}"`);
  fireEvent.keyDown(option, { key: 'Enter' });
}
