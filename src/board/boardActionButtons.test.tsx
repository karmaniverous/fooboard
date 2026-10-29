/**
 * The board's actions as icon buttons (spec 0.2.0 §3.A; Decisions 80 and
 * 98, #53): each is 36 px square, named by the label its tooltip repeats;
 * the tooltip shows on hover and on keyboard focus; a tap opens the panel
 * or the legend without a tooltip; and focus returns to the button as
 * its panel or legend closes, with the tooltip after a click and without
 * it after a touch.
 *
 * @module
 */
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { Pencil } from 'lucide-react';
import { describe, expect, it } from 'vitest';

import { SidePanel } from '@/components/SidePanel';
import { DashboardSchema } from '@/domain/config/dashboard';
import { focusElement } from '@/test/focus';

import { BoardActionButton } from './BoardActionButton';
import { StatusLegend } from './StatusLegend';

const LABEL = 'Edit dashboard';

/** A side panel opened by an icon button, as the board's actions are. */
function renderPanel(): HTMLElement {
  render(
    <SidePanel
      title={LABEL}
      tooltip={LABEL}
      trigger={<BoardActionButton label={LABEL} Icon={Pencil} />}
    >
      <p>Body</p>
    </SidePanel>,
  );
  return screen.getByRole('button', { name: LABEL });
}

/** The legend's button, rendered for an empty board. */
function renderLegend(): HTMLElement {
  render(
    <StatusLegend dashboard={DashboardSchema.parse({ id: 'd', name: 'D' })} />,
  );
  return screen.getByRole('button', { name: 'Legend' });
}

/** Press `button` with `pointerType`, as a tap or a click does. */
function press(button: HTMLElement, pointerType: 'touch' | 'mouse'): void {
  fireEvent.pointerDown(button, { pointerType });
  fireEvent.pointerUp(button, { pointerType });
  fireEvent.click(button);
}

/** Focus has come back to `button` (Radix returns it a task later). */
const focusReturnedTo = (button: HTMLElement): Promise<void> =>
  waitFor(() => {
    expect(button).toHaveFocus();
  });

/** Close the open panel with its Close button. */
function closePanel(): void {
  fireEvent.click(
    within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' }),
  );
}

describe('a board action button', () => {
  it('is 36 px square, named by its label, with only an icon', () => {
    const button = renderPanel();
    expect(button).toHaveClass('size-9');
    expect(button).not.toHaveClass('h-10');
    expect(button).toHaveTextContent('');
    expect(button.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('shows its name as its tooltip on keyboard focus', async () => {
    focusElement(renderPanel());
    expect(await screen.findByRole('tooltip')).toHaveTextContent(LABEL);
  });

  it('shows its name as its tooltip on hover', async () => {
    const button = renderPanel();
    fireEvent.pointerMove(button, { pointerType: 'mouse' });
    expect(await screen.findByRole('tooltip')).toHaveTextContent(LABEL);
  });

  it('opens its panel at a tap, with no tooltip', () => {
    press(renderPanel(), 'touch');
    expect(screen.getByRole('dialog', { name: LABEL })).toBeVisible();
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('takes focus back without a tooltip when a touch-opened panel closes', async () => {
    const button = renderPanel();
    press(button, 'touch');
    closePanel();
    await focusReturnedTo(button);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('takes focus back with its tooltip when a click-opened panel closes', async () => {
    const button = renderPanel();
    press(button, 'mouse');
    closePanel();
    await focusReturnedTo(button);
    expect(await screen.findByRole('tooltip')).toHaveTextContent(LABEL);
  });

  it('shows the tooltip again after a key press, once a touch had opened it', async () => {
    const button = renderPanel();
    press(button, 'touch');
    closePanel();
    await focusReturnedTo(button);
    fireEvent.keyDown(button, { key: 'Enter' });
    fireEvent.click(button);
    closePanel();
    expect(await screen.findByRole('tooltip')).toHaveTextContent(LABEL);
  });
});

describe('the Legend button', () => {
  it('is an icon button named and tooltipped Legend', async () => {
    const button = renderLegend();
    expect(button).toHaveClass('size-9');
    focusElement(button);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Legend');
  });

  it('takes focus back without a tooltip when a touch-opened legend closes', async () => {
    const button = renderLegend();
    press(button, 'touch');
    const legend = screen.getByRole('dialog', { name: 'Legend' });
    fireEvent.keyDown(legend, { key: 'Escape' });
    await focusReturnedTo(button);
    expect(screen.queryByRole('dialog', { name: 'Legend' })).toBeNull();
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});
