/**
 * A board action that opens a side panel (spec 0.2.0 §3.A): its icon
 * button, named by `label`, is the panel's trigger, and the same label is
 * its tooltip, so name and tooltip can't differ.
 *
 * @module
 */
import type { LucideIcon } from 'lucide-react';

import { SidePanel } from '@/components/SidePanel';

import { type ActionTone, BoardActionButton } from './BoardActionButton';

export function BoardActionPanel({
  title,
  label,
  Icon,
  tone,
  dot,
  open,
  onOpenChange,
  onCloseAutoFocus,
  children,
}: {
  /** The panel's title. */
  title: string;
  /** The button's name and tooltip: `title`, with a count if it has one. */
  label: string;
  Icon: LucideIcon;
  /** Its icon's emphasis (Decision 104). */
  tone?: ActionTone;
  /** The attention dot on its icon (Decision 105). */
  dot?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Where focus goes as the panel closes (`SidePanel`). */
  onCloseAutoFocus?: (e: Event) => void;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <SidePanel
      title={title}
      tooltip={label}
      open={open}
      onOpenChange={onOpenChange}
      onCloseAutoFocus={onCloseAutoFocus}
      trigger={
        <BoardActionButton label={label} Icon={Icon} tone={tone} dot={dot} />
      }
    >
      {children}
    </SidePanel>
  );
}
