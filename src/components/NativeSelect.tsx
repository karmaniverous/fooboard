/**
 * A native `<select>` in the app's style. Native, not a custom listbox:
 * the editors' choices are short, and the platform control is accessible
 * and touch-friendly as it is.
 *
 * @module
 */
import type { SelectHTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

export function NativeSelect({
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>): React.JSX.Element {
  return (
    <select
      className={cn('rounded-md border bg-background', className)}
      {...props}
    />
  );
}
