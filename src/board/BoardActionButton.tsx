/**
 * One of the board's actions beside its title (spec 0.2.0 §3.A; Decision
 * 80): an icon button named by `label`, the title of what it opens with
 * its count where there is one, which its tooltip (given by the panel or
 * popover it opens) repeats. Square at 36 px, the height of the text
 * buttons it replaced, so the line keeps its height.
 *
 * @module
 */
import type { LucideIcon } from 'lucide-react';
import type { ButtonHTMLAttributes, Ref } from 'react';

import { Button } from '@/components/ui/button';
import type { ButtonVariant } from '@/components/ui/buttonVariants';

/** 36 px square: `size="icon"` alone is 40 px (`buttonVariants`). */
const ACTION_BUTTON_SIZE = 'size-9';

export function BoardActionButton({
  label,
  Icon,
  variant = 'outline',
  ref,
  ...props
}: Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'aria-label' | 'children' | 'className'
> & {
  /** The accessible name, and the tooltip's text. */
  label: string;
  Icon: LucideIcon;
  variant?: ButtonVariant;
  /** Passed on by the trigger that wraps it. */
  ref?: Ref<HTMLButtonElement>;
}): React.JSX.Element {
  return (
    <Button
      ref={ref}
      size="icon"
      variant={variant}
      className={ACTION_BUTTON_SIZE}
      aria-label={label}
      {...props}
    >
      <Icon aria-hidden className="size-4" />
    </Button>
  );
}
