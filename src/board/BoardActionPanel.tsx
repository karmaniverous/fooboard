/**
 * A board action that opens a side panel (spec 0.2.0 §3.A): its icon
 * button, named by `label`, is the panel's trigger, and the same label is
 * its tooltip, so name and tooltip can't differ.
 *
 * @module
 */
import type { LucideIcon } from 'lucide-react';

import { SidePanel } from '@/components/SidePanel';
import type { ButtonVariant } from '@/components/ui/buttonVariants';

import { BoardActionButton } from './BoardActionButton';

export function BoardActionPanel({
  title,
  label,
  Icon,
  variant,
  open,
  onOpenChange,
  children,
}: {
  /** The panel's title. */
  title: string;
  /** The button's name and tooltip: `title`, with a count if it has one. */
  label: string;
  Icon: LucideIcon;
  variant?: ButtonVariant;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <SidePanel
      title={title}
      tooltip={label}
      open={open}
      onOpenChange={onOpenChange}
      trigger={
        <BoardActionButton label={label} Icon={Icon} variant={variant} />
      }
    >
      {children}
    </SidePanel>
  );
}
