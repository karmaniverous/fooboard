/**
 * The board's settings popup (spec.md §3.11 *The popup*, Decisions 52, 54
 * and 55): opened by a gear (or `,` on a focused cell), it edits the
 * settings of the gear's place through the shared settings editor and
 * nothing else. A popover anchored to the gear (`ui/popover`), or under
 * `SETTINGS_POPUP_NARROW_PX` a bottom sheet on the shared
 * header-over-scrolling-body layout (`PanelSheetContent`, §3.6), so its
 * header and *Close* stay in view while the editor scrolls.
 *
 * Its header names the level and the item; its body is the editor, each
 * change validated and saved at once (*Not saved* when refused); its foot,
 * where the board has a dashboard editor, *Open in dashboard settings*.
 * Modal: opening moves focus to its first field and Tab stays inside;
 * Escape closes the innermost open control, then the popup, and focus
 * returns to the gear, or to the cell whose `,` opened it.
 *
 * `SettingsPopupProvider` holds the one popup and renders it beside the
 * board's viewport, not inside it, so events in the popup never reach the
 * board's zoom keys or panning. Every popup opens through its `open`, so
 * that is where opening a cell's, row's or row group's settings boosts
 * the polling of the rows it covers (spec 0.2.0 §3.H).
 *
 * @module
 */
import { useId, useRef, useState } from 'react';

import { PanelSheetContent } from '@/components/SidePanel';
import { firstTabbable } from '@/components/tabbable';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverAnchor,
  PopoverClose,
  PopoverContent,
} from '@/components/ui/popover';
import { Sheet } from '@/components/ui/sheet';
import { useMediaQuery } from '@/components/useMediaQuery';
import type { Dashboard } from '@/domain/config/dashboard';
import { sourcesWithItems } from '@/domain/model/sources';
import type { SettingsPlace } from '@/domain/settings/places';
import { NotSaved } from '@/editors/NotSaved';
import { SourcesWithItemsContext } from '@/editors/rules/samples';
import { OpenPlaceContext } from '@/editors/settings/openPlace';
import { SettingsEntries } from '@/editors/settings/SettingsEditor';
import { useValidatedChange } from '@/editors/useValidatedChange';

import { placeTarget, useAttend } from './attentionContext';
import { popupTitle } from './settingsGearWords';
import {
  type PopupRequest,
  SETTINGS_NARROW_QUERY,
  SettingsPopupContext,
} from './settingsPopupContext';

/** What the popup saves through, and where it opens the editor. */
export interface SettingsPopupActions {
  /** Save the dashboard (validated first). */
  onChange: (dashboard: Dashboard) => void;
  /** Open *Edit dashboard* at a place's settings; absent where the board
   * has no dashboard editor (the demo, until N3b). */
  onOpenSettings?: (place: SettingsPlace) => void;
}

function SettingsPopup({
  dashboard,
  request,
  onChange,
  onOpenSettings,
  onClose,
}: SettingsPopupActions & {
  dashboard: Dashboard;
  request: PopupRequest;
  onClose: () => void;
}): React.JSX.Element {
  const narrow = useMediaQuery(SETTINGS_NARROW_QUERY);
  const { update, error } = useValidatedChange(onChange);
  const titleId = useId();
  const body = useRef<HTMLDivElement>(null);
  const [anchor] = useState(() => ({
    current: document.getElementById(request.gearId),
  }));
  // Leaving for the dashboard editor: focus goes there, not back.
  const leaving = useRef(false);
  const openInEditor = (place: SettingsPlace) => {
    leaving.current = true;
    onClose();
    onOpenSettings?.(place);
  };
  const returnFocus = (e: Event) => {
    e.preventDefault();
    if (!leaving.current) request.returnFocus?.focus();
  };
  const title = popupTitle(dashboard, request.place);
  const editor = (
    <OpenPlaceContext value={onOpenSettings && openInEditor}>
      <SourcesWithItemsContext value={sourcesWithItems(dashboard)}>
        <NotSaved error={error} />
        <SettingsEntries
          dashboard={dashboard}
          place={request.place}
          onChange={update}
        />
      </SourcesWithItemsContext>
    </OpenPlaceContext>
  );
  const foot = onOpenSettings && (
    <Button
      variant="link"
      size="sm"
      className="h-auto self-start p-0 text-xs"
      onClick={() => {
        openInEditor(request.place);
      }}
    >
      Open in dashboard settings
    </Button>
  );

  if (narrow) {
    return (
      <Sheet open onOpenChange={onClose}>
        <PanelSheetContent
          side="bottom"
          title={title}
          onCloseAutoFocus={returnFocus}
        >
          {editor}
          {foot}
        </PanelSheetContent>
      </Sheet>
    );
  }
  return (
    <Popover open modal onOpenChange={onClose}>
      {anchor.current && <PopoverAnchor virtualRef={anchor} />}
      <PopoverContent
        aria-labelledby={titleId}
        side="bottom"
        align="end"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          firstTabbable(body.current)?.focus();
        }}
        onCloseAutoFocus={returnFocus}
        className="flex max-h-[var(--radix-popover-content-available-height)] w-96 max-w-[calc(100vw-12px)] flex-col p-0"
      >
        <div className="flex shrink-0 items-start gap-2 border-b border-border px-4 py-2">
          <h2 id={titleId} className="min-w-0 flex-1 text-sm font-semibold">
            {title}
          </h2>
          <PopoverClose className="-mr-1 shrink-0" />
        </div>
        <div
          ref={body}
          className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-4 py-3"
        >
          {editor}
        </div>
        {foot && (
          <div className="shrink-0 border-t border-border px-4 py-2">
            {foot}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

/** The board's one settings popup, and the context its gears open it
 * through. */
export function SettingsPopupProvider({
  dashboard,
  children,
  ...actions
}: SettingsPopupActions & {
  dashboard: Dashboard;
  children: React.ReactNode;
}): React.JSX.Element {
  const [request, setRequest] = useState<PopupRequest | null>(null);
  const attend = useAttend();
  const open = (next: PopupRequest) => {
    const target = placeTarget(next.place);
    if (target) attend(target, 'click');
    setRequest(next);
  };
  return (
    <SettingsPopupContext value={{ dashboard, request, open }}>
      {children}
      {request && (
        <SettingsPopup
          // A new gear's popup starts afresh (its own *Not saved*).
          key={request.gearId}
          dashboard={dashboard}
          request={request}
          onClose={() => {
            setRequest(null);
          }}
          {...actions}
        />
      )}
    </SettingsPopupContext>
  );
}
