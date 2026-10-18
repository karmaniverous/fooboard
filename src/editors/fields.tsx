/**
 * The editors' text field: commits on blur or Enter.
 *
 * @module
 */
import { useState } from 'react';

import { Input } from '@/components/ui/input';

/**
 * A text field that commits a trimmed value on blur or Enter, when it
 * changed. A required field (names, patterns) reverts when emptied; an
 * optional one (labels, overrides) commits `''` to clear. It follows the
 * saved value when that changes underneath (e.g. reordering).
 */
export function CommitInput({
  value,
  onCommit,
  label,
  className,
  optional = false,
  placeholder,
  list,
}: {
  value: string;
  onCommit: (value: string) => void;
  label: string;
  className?: string;
  optional?: boolean;
  placeholder?: string;
  /** A datalist id offering suggestions. */
  list?: string;
}): React.JSX.Element {
  const [draft, setDraft] = useState(value);
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    setDraft(value);
  }
  const commit = () => {
    const next = draft.trim();
    if ((next || optional) && next !== value) onCommit(next);
    else setDraft(value);
  };
  return (
    <Input
      aria-label={label}
      className={className}
      placeholder={placeholder}
      list={list}
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
