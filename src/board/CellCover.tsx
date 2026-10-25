/**
 * A status cell's cover control (spec.md §3.10 accessibility checks),
 * laid under its text and carrying its accessible name. With a link (the
 * job, or the Amplify console) it is that link: a click or Enter follows
 * it, a touch tap or the details key (Space) opens the detail sheet. A
 * record with no link (possible with a custom source rule) has nothing to
 * follow, so the cover is a button, as an empty cell is: a click, a tap,
 * Enter or Space opens the sheet. Either way the cell is reached with Tab,
 * shows its tooltip on focus and says Space opens its details (and, on a
 * board with settings, that `,` opens its settings: `keyshortcuts`).
 *
 * @module
 */
import { useRef } from 'react';

import { ExternalLink } from '@/components/ExternalLink';

import { cellKeyshortcuts, DETAILS_KEY } from './cellView';

/** Hover and focus handlers showing the cell's tooltip. */
export interface Inspect {
  onMouseEnter: (e: React.MouseEvent<HTMLElement>) => void;
  onMouseLeave: () => void;
  onFocus: (e: React.FocusEvent<HTMLElement>) => void;
  onBlur: () => void;
}

const COVER_CLASS =
  'absolute inset-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white';

export function CellCover({
  href,
  name,
  inspect,
  onOpenSheet,
  settingsKey,
}: {
  /** Where the cell leads; absent when its record has no link. */
  href: string | undefined;
  /** The cell's accessible name. */
  name: string;
  inspect: Inspect;
  onOpenSheet?: () => void;
  /** The board has a settings popup, which `,` opens. */
  settingsKey?: boolean;
}): React.JSX.Element {
  const touched = useRef(false);
  const keyshortcuts = onOpenSheet ? cellKeyshortcuts(settingsKey) : undefined;
  if (href === undefined) {
    return (
      <button
        type="button"
        aria-label={name}
        aria-keyshortcuts={keyshortcuts}
        className={COVER_CLASS}
        onClick={onOpenSheet}
        {...inspect}
      />
    );
  }
  return (
    <ExternalLink
      unstyled
      href={href}
      aria-label={name}
      aria-keyshortcuts={keyshortcuts}
      className={COVER_CLASS}
      onPointerDown={(e) => {
        touched.current = e.pointerType === 'touch';
      }}
      onClick={(e) => {
        // A tap opens the detail sheet; a click and Enter follow the link.
        if (touched.current && onOpenSheet) {
          e.preventDefault();
          onOpenSheet();
        }
      }}
      onKeyDown={(e) => {
        // The details key opens the sheet (and doesn't scroll the page).
        if (
          e.key !== DETAILS_KEY.key ||
          !onOpenSheet ||
          e.altKey ||
          e.ctrlKey ||
          e.metaKey ||
          e.shiftKey
        )
          return;
        e.preventDefault();
        onOpenSheet();
      }}
      {...inspect}
    />
  );
}
