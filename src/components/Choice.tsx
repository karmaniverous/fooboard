/**
 * A single choice from a short list, on the library's Select. The trigger
 * is as wide as its widest option (never clipped), unless the row is
 * narrower. An empty-string value is allowed (Radix reserves it, so it is
 * mapped to a private sentinel).
 *
 * @module
 */
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

const NONE = '\u0000none';
const toItem = (v: string) => (v === '' ? NONE : v);
const fromItem = (v: string) => (v === NONE ? '' : v);

export interface ChoiceOption<T extends string = string> {
  value: T;
  label: string;
  disabled?: boolean;
}

/** Choose among `options`; `onValueChange` gets the chosen option's own
 * typed value (looked up, never cast), so callers need no assertion. */
export function Choice<T extends string>({
  label,
  value,
  options,
  onValueChange,
  className,
  disabled,
  describedBy,
  labelledBy,
}: {
  /** The accessible name. */
  label: string;
  /** The id of a visible label naming the choice instead of `label`. */
  labelledBy?: string;
  /** The id of the text that describes the choice (its hint). */
  describedBy?: string;
  value: T;
  options: readonly ChoiceOption<T>[];
  onValueChange: (value: T) => void;
  className?: string;
  disabled?: boolean;
}): React.JSX.Element {
  const selected = options.find((o) => o.value === value);
  return (
    <Select
      value={toItem(value)}
      disabled={disabled}
      onValueChange={(v) => {
        const picked = options.find((o) => o.value === fromItem(v));
        if (picked) onValueChange(picked.value);
      }}
    >
      <SelectTrigger
        aria-label={label}
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        className={cn('h-9 w-fit max-w-full shrink-0 text-sm', className)}
      >
        {/* Every label stacked in one cell: the widest sets the width. */}
        <span className="grid min-w-0">
          <span className="col-start-1 row-start-1 truncate">
            <SelectValue>{selected?.label}</SelectValue>
          </span>
          {options.map((o) => (
            <span
              key={o.value}
              aria-hidden
              className="invisible col-start-1 row-start-1 h-0 truncate"
            >
              {o.label}
            </span>
          ))}
        </span>
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem
            key={o.value}
            value={toItem(o.value)}
            disabled={o.disabled}
          >
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
