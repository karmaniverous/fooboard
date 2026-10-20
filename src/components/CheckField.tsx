/**
 * A labelled on/off setting: the library's Checkbox with its Label
 * associated, reporting a plain boolean (Radix's checked state can also
 * be `'indeterminate'`, which counts as off here).
 *
 * @module
 */
import { useId } from 'react';

import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export function CheckField({
  label,
  checked,
  onCheckedChange,
  className,
}: {
  /** The visible label, which is also the accessible name. */
  label: React.ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
}): React.JSX.Element {
  const id = useId();
  return (
    <span className={cn('flex items-center gap-1 text-xs', className)}>
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(next) => {
          onCheckedChange(next === true);
        }}
      />
      <Label htmlFor={id}>{label}</Label>
    </span>
  );
}
