/**
 * One of the board's actions beside its title (spec 0.2.0 §3.A; Decisions
 * 80 and 104): an icon button named by `label`, the title of what it
 * opens with its count where there is one, which its tooltip (given by
 * the panel or popover it opens) repeats. Square at 36 px, the height of
 * the text buttons it replaced, so the line keeps its height. It has the
 * header's ghost style (no outline or fill at rest); emphasis is the
 * icon's colour (`tone`): destructive for *Problems*, primary for *Add a
 * credential*, the foreground for the rest.
 *
 * @module
 */
import type { LucideIcon } from 'lucide-react';
import type { ButtonHTMLAttributes, Ref } from 'react';

import { Button } from '@/components/ui/button';

/** 36 px square: `size="icon"` alone is 40 px (`buttonVariants`). */
const ACTION_BUTTON_SIZE = 'size-9';

/** How an action is emphasised: its icon's colour. */
export type ActionTone = 'plain' | 'destructive' | 'primary';

/** Each tone's icon colour; plain takes the button's foreground. */
const ICON_TONE: Record<ActionTone, string | undefined> = {
  plain: undefined,
  destructive: 'text-destructive',
  primary: 'text-primary',
};

export function BoardActionButton({
  label,
  Icon,
  tone = 'plain',
  ref,
  ...props
}: Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'aria-label' | 'children' | 'className'
> & {
  /** The accessible name, and the tooltip's text. */
  label: string;
  Icon: LucideIcon;
  tone?: ActionTone;
  /** Passed on by the trigger that wraps it. */
  ref?: Ref<HTMLButtonElement>;
}): React.JSX.Element {
  const toneClass = ICON_TONE[tone];
  return (
    <Button
      ref={ref}
      size="icon"
      variant="ghost"
      className={ACTION_BUTTON_SIZE}
      aria-label={label}
      {...props}
    >
      <Icon
        aria-hidden
        className={toneClass ? `size-4 ${toneClass}` : 'size-4'}
      />
    </Button>
  );
}
