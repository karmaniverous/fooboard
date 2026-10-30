/**
 * Copy a list for the user's AI assistant (spec 0.2.0 §3.J *The fix
 * loop*): a button that copies a one-line preamble saying what the list
 * is, then each line, so the assistant that built a share can correct it;
 * then says whether it copied. Used by the import's refusal and the
 * Problems panel.
 *
 * @module
 */
import { Copy } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { copyText } from '@/lib/clipboard';
import { copiedNote, forAssistant } from '@/lib/forAssistant';

export function CopyForAssistant({
  label,
  preamble,
  lines,
}: {
  /** The button's text. */
  label: string;
  /** The line above the list, saying what it is. */
  preamble: string;
  lines: readonly string[];
}): React.JSX.Element {
  const [said, setSaid] = useState('');
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="gap-1.5"
        onClick={() => {
          copyText(forAssistant(preamble, lines), (ok) => {
            setSaid(copiedNote(ok));
          });
        }}
      >
        <Copy aria-hidden className="size-4" />
        {label}
      </Button>
      <span role="status" className="text-xs text-muted-foreground">
        {said}
      </span>
    </div>
  );
}
