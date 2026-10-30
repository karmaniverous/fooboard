/**
 * The attention dot: a small dot that marks something waiting for the
 * user. The menu's *Release notes* shows it for a version this browser
 * hasn't seen (spec 0.2.0 §3.D; Decision 100), and the board's
 * *Credentials* button while the dashboard has no credential (§3.A;
 * Decision 105). It is decoration (`aria-hidden`): the names say it.
 * Placement (`className`) and any data attributes come from the caller.
 *
 * @module
 */
import type { HTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

export function AttentionDot({
  className,
  ...props
}: Omit<
  HTMLAttributes<HTMLSpanElement>,
  'aria-hidden' | 'children'
>): React.JSX.Element {
  return (
    <span
      {...props}
      aria-hidden
      className={cn('size-2 rounded-full bg-status-started', className)}
    />
  );
}
