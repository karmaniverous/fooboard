/**
 * The pinned-header layout (spec.md §3.6, Decisions 12, 33 and 55): a
 * header holding the title, the close button and, optionally, tabs, over
 * a body that alone scrolls, so the header never scrolls away and never
 * covers what the body scrolls to (fix and focus targets, a dragged
 * item). One component, `PanelSheetContent`, serves every side panel
 * (`SidePanel`) and every bottom sheet (the cell detail sheet; the
 * settings popup's narrow-screen sheet).
 *
 * Tabs belong to whatever owns their state, usually the body (the
 * dashboard editor): it renders them in `PanelTabs`, which places them in
 * the header's tab row, so the tab order runs header, then body. On open,
 * focus goes to the first control after the close button (the selected
 * tab, else the body's first control, else Close), as it did when the
 * close button came last. Tabs
 * reach the header a render after the panel mounts, so that focus waits
 * for the render after Radix asks for it.
 *
 * A side panel's trigger may carry a tooltip (the board's icon buttons,
 * spec 0.2.0 §3.A): focus returns to the trigger on close with the
 * tooltip after a click or a key press, without it after a touch
 * (`useTouchFocusReturn`).
 *
 * @module
 */
import { createContext, use, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import {
  Sheet,
  SheetCloseButton,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { WithTooltip } from '@/components/ui/tooltip';

import { firstTabbable } from './tabbable';
import { useTouchFocusReturn } from './useTouchFocusReturn';

/** The header's tab row: undefined outside a panel, null until mounted. */
const TabRow = createContext<HTMLElement | null | undefined>(undefined);

/** The selected tab under `root`, if any. Focus goes to it, not to its
 * tab list: a browser doesn't pass a list's programmatic focus on. */
const selectedTab = (root: HTMLElement | null): HTMLElement | undefined =>
  root?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]') ??
  undefined;

/** The library's `SheetContent`, laid out as a header (title, close,
 * tabs) over a body that alone scrolls. */
export function PanelSheetContent({
  side,
  title,
  className,
  onCloseAutoFocus,
  children,
}: Pick<
  React.ComponentPropsWithoutRef<typeof SheetContent>,
  // Classes for the sheet (e.g. its colours); where focus goes on close
  // (default: the opener).
  'className' | 'onCloseAutoFocus'
> & {
  side: 'right' | 'bottom';
  /** Shown in the header; it names the panel (its dialog). */
  title: React.ReactNode;
  /** The body. */
  children: React.ReactNode;
}): React.JSX.Element {
  const [tabRow, setTabRow] = useState<HTMLDivElement | null>(null);
  const header = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const [focusAsked, setFocusAsked] = useState(false);
  useEffect(() => {
    if (!focusAsked) return;
    const first =
      selectedTab(tabRow) ??
      firstTabbable(body.current) ??
      firstTabbable(header.current);
    first?.focus();
  }, [focusAsked, tabRow]);
  return (
    <SheetContent
      side={side}
      className={className}
      onOpenAutoFocus={(e) => {
        e.preventDefault();
        setFocusAsked(true);
      }}
      onCloseAutoFocus={onCloseAutoFocus}
    >
      <div
        ref={header}
        data-panel-header
        className="flex shrink-0 flex-col gap-3 border-b border-current/10 px-5 pb-3 pt-5"
      >
        <div className="flex items-start gap-2">
          <SheetTitle className="min-w-0 flex-1 pr-0">{title}</SheetTitle>
          <SheetCloseButton className="-mr-1 shrink-0" />
        </div>
        <div ref={setTabRow} className="empty:hidden" />
      </div>
      <div
        ref={body}
        data-panel-body
        className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 pb-5 pt-3"
      >
        <TabRow value={tabRow}>{children}</TabRow>
      </div>
    </SheetContent>
  );
}

/** Tabs (a `TabsList`) shown in the enclosing panel's header, pinned
 * with it; outside a panel (e.g. an editor on its own), in place. */
export function PanelTabs({
  children,
}: {
  children: React.ReactNode;
}): React.ReactNode {
  const tabRow = use(TabRow);
  if (tabRow === undefined) return children;
  return tabRow && createPortal(children, tabRow);
}

/** A side panel (the dashboard editor, credentials, problems, unmapped
 * runs): the library's Sheet from the right, on `PanelSheetContent`. */
export function SidePanel({
  title,
  trigger,
  tooltip,
  open,
  onOpenChange,
  children,
}: {
  title: string;
  /** The element that opens the panel. */
  trigger: React.ReactNode;
  /** The trigger's tooltip, if it has one (an icon button's name). */
  tooltip?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}): React.JSX.Element {
  const { triggerProps, onCloseAutoFocus } = useTouchFocusReturn();
  const sheetTrigger = (
    <SheetTrigger asChild {...triggerProps}>
      {trigger}
    </SheetTrigger>
  );
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {tooltip === undefined ? (
        sheetTrigger
      ) : (
        <WithTooltip label={tooltip}>{sheetTrigger}</WithTooltip>
      )}
      <PanelSheetContent
        side="right"
        title={title}
        onCloseAutoFocus={onCloseAutoFocus}
      >
        {children}
      </PanelSheetContent>
    </Sheet>
  );
}
