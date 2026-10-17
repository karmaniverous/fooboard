/**
 * Small editor fields shared by every editor section.
 *
 * @module
 */
import { useState } from 'react';

import { NativeSelect } from '@/components/NativeSelect';
import { Input } from '@/components/ui/input';
import type { Divider, DividerStyle } from '@/domain/config/dividers';

/**
 * A text field that commits on blur or Enter, and only a non-empty value
 * (names and patterns are required). An emptied field reverts.
 */
export function CommitInput({
  value,
  onCommit,
  label,
  className,
}: {
  value: string;
  onCommit: (value: string) => void;
  label: string;
  className?: string;
}): React.JSX.Element {
  const [draft, setDraft] = useState(value);
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    // The saved value changed underneath (e.g. reordering): follow it.
    setSeen(value);
    setDraft(value);
  }
  const commit = () => {
    const next = draft.trim();
    if (next && next !== value) onCommit(next);
    else setDraft(value);
  };
  return (
    <Input
      aria-label={label}
      className={className}
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value);
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
      }}
    />
  );
}

const STYLES: DividerStyle[] = ['thin', 'thick', 'double', 'dashed', 'blank'];

/** The divider before a row or stage (spec.md C-14b): style and label. */
export function DividerControl({
  name,
  divider,
  onChange,
}: {
  /** The row or stage name, for labels. */
  name: string;
  divider: Divider | undefined;
  onChange: (divider: Omit<Divider, 'beforeId'> | undefined) => void;
}): React.JSX.Element {
  const [label, setLabel] = useState(divider?.label ?? '');
  const emit = (style: DividerStyle | '', text: string) => {
    onChange(
      style
        ? { style, ...(text.trim() ? { label: text.trim() } : {}) }
        : undefined,
    );
  };
  return (
    <div className="flex items-center gap-1 text-xs">
      <NativeSelect
        aria-label={`Divider before ${name}`}
        className="h-7 px-1"
        value={divider?.style ?? ''}
        onChange={(e) => {
          emit(e.target.value as DividerStyle | '', label);
        }}
      >
        <option value="">No divider before</option>
        {STYLES.map((s) => (
          <option key={s} value={s}>
            {s} divider before
          </option>
        ))}
      </NativeSelect>
      {divider && (
        <Input
          aria-label={`Group label before ${name}`}
          placeholder="Group label (optional)"
          className="h-7 text-xs"
          value={label}
          onChange={(e) => {
            setLabel(e.target.value);
          }}
          onBlur={() => {
            emit(divider.style, label);
          }}
        />
      )}
    </div>
  );
}
