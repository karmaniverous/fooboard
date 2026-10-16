/**
 * A pressed/unpressed button for small option groups (row height, summary
 * filters): `aria-pressed` carries the state for assistive technology.
 *
 * @module
 */
import type { ButtonHTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

export function ToggleButton({
  pressed,
  className,
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'aria-pressed'> & {
  pressed: boolean;
}): React.JSX.Element {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={cn(
        'text-xs',
        pressed ? 'bg-foreground text-background' : 'bg-background',
        className,
      )}
      {...props}
    />
  );
}
