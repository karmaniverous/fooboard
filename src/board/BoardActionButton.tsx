/**
 * One of the board's actions beside its title (spec 0.2.0 §3.A; Decisions
 * 80, 104 and 105): an icon button named by `label`, the title of what it
 * opens with its count where there is one, which its tooltip (given by
 * the panel or popover it opens) repeats. Square at 36 px, the height of
 * the text buttons it replaced, so the line keeps its height. It has the
 * header's ghost style (no outline or fill at rest); emphasis is the
 * icon's colour (`tone`), destructive for *Problems* and the foreground
 * for the rest, or the attention dot on the icon (`dot`) for *Add a
 * credential*.
 *
 * @module
 */
import type { LucideIcon } from 'lucide-react';
import type { ButtonHTMLAttributes, Ref } from 'react';

import { AttentionDot } from '@/components/AttentionDot';
import { Button } from '@/components/ui/button';

/** 36 px square: `size="icon"` alone is 40 px (`buttonVariants`). */
const ACTION_BUTTON_SIZE = 'relative size-9';

/** How an action is emphasised: its icon's colour. */
export type ActionTone = 'plain' | 'destructive';

/** Each tone's icon colour; plain takes the button's foreground. */
const ICON_TONE: Record<ActionTone, string | undefined> = {
  plain: undefined,
  destructive: 'text-destructive',
};

export function BoardActionButton({
  label,
  Icon,
  tone = 'plain',
  dot = false,
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
  /** Mark the icon with the attention dot (Decision 105). */
  dot?: boolean;
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
      {/* At the icon's top-right corner, as the menu button's dot is. */}
      {dot && (
        <AttentionDot data-action-dot className="absolute right-1.5 top-1.5" />
      )}
    </Button>
  );
}
