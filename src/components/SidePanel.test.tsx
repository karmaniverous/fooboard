/**
 * Tests for the pinned-header layout (spec.md §3.6): the title, the close
 * button and any tabs sit outside the body, which alone scrolls; Tab runs
 * header, then body; opening focuses the first tab, else the body's first
 * control; closing returns focus to the trigger, unless a close handler
 * prevents that and puts it elsewhere, after a touch open too; tabs
 * outside a panel stay in place.
 *
 * @module
 */
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  applyOverflowUtility,
  scrollContainerOf,
} from '@/test/scrollContainer';

import { PanelTabs, SidePanel } from './SidePanel';

let restore: () => void;
beforeEach(() => {
  restore = applyOverflowUtility();
});
afterEach(() => {
  restore();
});

const sections = (
  <PanelTabs>
    <TabsList aria-label="Sections">
      <TabsTrigger value="one">One</TabsTrigger>
      <TabsTrigger value="two">Two</TabsTrigger>
    </TabsList>
  </PanelTabs>
);

function panel(
  body: React.ReactNode,
  onOpenChange: (open: boolean) => void = () => undefined,
): HTMLElement {
  render(
    <SidePanel
      open
      onOpenChange={onOpenChange}
      title="Edit dashboard"
      trigger={<Button>Edit</Button>}
    >
      {body}
    </SidePanel>,
  );
  return screen.getByRole('dialog', { name: 'Edit dashboard' });
}

const tabbed = (
  <Tabs defaultValue="one">
    {sections}
    <TabsContent value="one">
      <Button>In the body</Button>
    </TabsContent>
  </Tabs>
);

describe('SidePanel', () => {
  it('pins the title, close and tabs outside the body, which alone scrolls', () => {
    const dialog = panel(tabbed);
    const body = scrollContainerOf(
      screen.getByRole('button', { name: 'In the body' }),
    );
    expect(dialog).toContainElement(body);
    const header = [
      screen.getByRole('heading', { name: 'Edit dashboard' }),
      screen.getByRole('button', { name: 'Close' }),
      screen.getByRole('tablist', { name: 'Sections' }),
    ];
    for (const el of header) {
      expect(body).not.toContainElement(el);
      // Nothing inside the panel scrolls the header.
      expect(dialog).not.toContainElement(scrollContainerOf(el));
    }
  });

  it('runs Tab through the header (close, then tabs) before the body', () => {
    const dialog = panel(tabbed);
    const body = scrollContainerOf(
      screen.getByRole('button', { name: 'In the body' }),
    );
    // What Tab reaches, in document order (the tab list forwards focus to
    // its selected tab, Radix's roving focus).
    const reachable = [...dialog.querySelectorAll<HTMLElement>('*')].filter(
      (el) => el.tabIndex >= 0,
    );
    expect(
      reachable.map((el) => [
        el.getAttribute('role') ?? el.textContent,
        body?.contains(el),
      ]),
    ).toEqual([
      ['', false],
      ['tablist', false],
      ['tab', false],
      ['tabpanel', true],
      ['In the body', true],
    ]);
    expect(reachable[0]).toHaveAccessibleName('Close');
  });

  it.each([
    ['the selected tab', tabbed, 'One'],
    [
      'the body when there are no tabs',
      <Button key="b">First</Button>,
      'First',
    ],
  ])('focuses %s on open, not Close', (_, body, name) => {
    panel(body);
    expect(document.activeElement).toHaveAccessibleName(name);
  });

  it('focuses the selected tab itself, not its list', () => {
    const focus = vi.spyOn(HTMLElement.prototype, 'focus');
    panel(
      <Tabs defaultValue="two">
        {sections}
        <TabsContent value="two">
          <Button>In the body</Button>
        </TabsContent>
      </Tabs>,
    );
    const two = screen.getByRole('tab', { name: 'Two' });
    expect(two).toHaveFocus();
    expect(focus.mock.contexts).not.toContain(
      screen.getByRole('tablist', { name: 'Sections' }),
    );
    focus.mockRestore();
  });

  it('skips what Tab skips when focusing on open', () => {
    panel(
      <>
        <input type="hidden" name="kept" />
        <div hidden>
          <Button>Hidden</Button>
        </div>
        <Button disabled>Off</Button>
        <p tabIndex={-1}>Not in the Tab order</p>
        <Button>On</Button>
      </>,
    );
    expect(document.activeElement).toHaveAccessibleName('On');
  });

  it('focuses Close when nothing else can take focus', () => {
    panel(<p>Nothing to do here.</p>);
    expect(document.activeElement).toHaveAccessibleName('Close');
  });

  it('closes from its pinned close button', () => {
    const onOpenChange = vi.fn();
    const dialog = panel(tabbed, onOpenChange);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

/** A panel opened from its trigger by `pointerType`, an input beside it
 * that its close handler (if `prevent`) focuses, preventing the default
 * return; then closed. Returns the trigger and the input. */
function closeWithHandler(
  pointerType: 'touch' | 'mouse',
  prevent: boolean,
): { trigger: HTMLElement; elsewhere: HTMLElement } {
  render(
    <>
      <input aria-label="Elsewhere" />
      <SidePanel
        title="Edit dashboard"
        trigger={<Button>Edit</Button>}
        onCloseAutoFocus={(e) => {
          if (!prevent) return;
          e.preventDefault();
          screen.getByRole('textbox', { name: 'Elsewhere' }).focus();
        }}
      >
        <Button>In the body</Button>
      </SidePanel>
    </>,
  );
  const trigger = screen.getByRole('button', { name: 'Edit' });
  const elsewhere = screen.getByRole('textbox', { name: 'Elsewhere' });
  // Radix returns focus to what had it on open.
  act(() => {
    trigger.focus();
  });
  fireEvent.pointerDown(trigger, { pointerType });
  fireEvent.pointerUp(trigger, { pointerType });
  fireEvent.click(trigger);
  fireEvent.click(
    within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' }),
  );
  return { trigger, elsewhere };
}

describe('SidePanel closing', () => {
  it.each(['touch', 'mouse'] as const)(
    'returns focus to the trigger after a %s open',
    async (pointerType) => {
      const { trigger } = closeWithHandler(pointerType, false);
      await waitFor(() => {
        expect(trigger).toHaveFocus();
      });
    },
  );

  it.each(['touch', 'mouse'] as const)(
    'keeps focus where a preventing handler put it after a %s open',
    async (pointerType) => {
      const { trigger, elsewhere } = closeWithHandler(pointerType, true);
      // The handler and any return run in one go, a task after closing.
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(elsewhere).toHaveFocus();
      });
      expect(trigger).not.toHaveFocus();
    },
  );
});

describe('PanelTabs', () => {
  it('leaves tabs in place outside a panel', () => {
    const { container } = render(tabbed);
    expect(container).toContainElement(
      screen.getByRole('tablist', { name: 'Sections' }),
    );
  });
});
