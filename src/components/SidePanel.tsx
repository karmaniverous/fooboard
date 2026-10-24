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
 * focus goes to the first control after the close button (the tabs, else
 * the body), as it did when the close button came last.
 *
 * @module
 */
import { createContext, use, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import {
  Sheet,
  SheetCloseButton,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

/** The header's tab row: undefined outside a panel, null until mounted. */
const TabRow = createContext<HTMLElement | null | undefined>(undefined);

/** The first element under `root` that Tab reaches, if any. */
function firstTabbable(root: HTMLElement | null): HTMLElement | undefined {
  if (!root) return undefined;
  return [...root.querySelectorAll<HTMLElement>('*')].find(
    (el) =>
      el.tabIndex >= 0 &&
      !el.hidden &&
      !el.matches(':disabled, input[type="hidden"]'),
  );
}

/** The library's `SheetContent`, laid out as a header (title, close,
 * tabs) over a body that alone scrolls. */
export function PanelSheetContent({
  side,
  title,
  className,
  onCloseAutoFocus,
  children,
}: {
  side: 'right' | 'bottom';
  /** Shown in the header; it names the panel (its dialog). */
  title: React.ReactNode;
  /** Classes for the sheet (e.g. its colours). */
  className?: string;
  /** Where focus goes on close (Radix's handler; default: the opener). */
  onCloseAutoFocus?: (event: Event) => void;
  /** The body. */
  children: React.ReactNode;
}): React.JSX.Element {
  const [tabRow, setTabRow] = useState<HTMLDivElement | null>(null);
  const body = useRef<HTMLDivElement>(null);
  return (
    <SheetContent
      side={side}
      className={className}
      onOpenAutoFocus={(e) => {
        const first = firstTabbable(tabRow) ?? firstTabbable(body.current);
        if (!first) return;
        e.preventDefault();
        first.focus({ preventScroll: true });
      }}
      onCloseAutoFocus={onCloseAutoFocus}
    >
      <div
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
  open,
  onOpenChange,
  children,
}: {
  title: string;
  /** The element that opens the panel. */
  trigger: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <PanelSheetContent side="right" title={title}>
        {children}
      </PanelSheetContent>
    </Sheet>
  );
}
