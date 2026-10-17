/**
 * A destructive action that asks first (spec.md C-21: deletions ask for
 * confirmation): the first press swaps in a named confirm button and a
 * *Keep* button.
 *
 * @module
 */
import { useState } from 'react';

import { Button } from '@/components/ui/button';

export function ConfirmButton({
  children,
  confirmLabel,
  onConfirm,
  label,
}: {
  children: React.ReactNode;
  /** Accessible name for the first button, when its text is ambiguous. */
  label?: string;
  /** Names what goes, e.g. "Remove acme". */
  confirmLabel: string;
  onConfirm: () => void;
}): React.JSX.Element {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <Button
        size="sm"
        variant="outline"
        aria-label={label}
        onClick={() => {
          setAsking(true);
        }}
      >
        {children}
      </Button>
    );
  }
  return (
    <span className="inline-flex gap-1">
      <Button size="sm" variant="destructive" onClick={onConfirm}>
        {confirmLabel}
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          setAsking(false);
        }}
      >
        Keep
      </Button>
    </span>
  );
}
