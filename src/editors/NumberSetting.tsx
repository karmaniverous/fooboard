/**
 * One numeric dashboard setting on the General tab (spec.md §3.2, spec
 * §3.L): a labelled number field that commits on blur or Enter, held to
 * its range by `hold`. An empty field, or one the browser couldn't read as
 * a number, keeps the value rather than reading as 0, and an unchanged
 * value commits nothing. Shared by *Requests in flight* and *While the tab
 * is hidden*.
 *
 * @module
 */
import { useState } from 'react';

import { Input } from '@/components/ui/input';

export function NumberSetting({
  label,
  value,
  min,
  max,
  hold,
  describedBy,
  onCommit,
}: {
  label: string;
  /** The value, in the field's own units. */
  value: number;
  min: number;
  max: number;
  /** A typed value held to the setting's range (and precision). */
  hold: (typed: number) => number;
  describedBy: string;
  onCommit: (value: number) => void;
}): React.JSX.Element {
  const [draft, setDraft] = useState(String(value));
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    setDraft(String(value));
  }
  const commit = () => {
    const parsed = draft.trim() === '' ? NaN : Number(draft);
    const next = Number.isFinite(parsed) ? hold(parsed) : value;
    setDraft(String(next));
    if (next !== value) onCommit(next);
  };
  return (
    <label className="flex items-center gap-2">
      <span className="w-48 text-xs">{label}</span>
      <Input
        type="number"
        className="h-8 w-20 text-xs"
        aria-label={label}
        aria-describedby={describedBy}
        min={min}
        max={max}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
        }}
      />
    </label>
  );
}
