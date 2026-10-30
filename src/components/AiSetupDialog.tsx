/**
 * *Set up with an AI assistant* (spec 0.2.0 §3.J *The dialog*; Decision
 * 90): the address of the instructions for assistants with *Copy link*,
 * a ready prompt with *Copy prompt*, and one line on how it works. The
 * address is production's canonical host on every host (Decision 96).
 * Opened from the navigation item and the home page.
 *
 * @module
 */
import { Copy } from 'lucide-react';
import { useId, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { copyText } from '@/lib/clipboard';
import { AI_PROMPT, site } from '@/lib/site';

/** The dialog's title, the navigation item's label and the home page's
 * button (with an ellipsis there). */
export const AI_SETUP = 'Set up with an AI assistant';

/** How it works, under the title. */
export const AI_SETUP_HOW =
  'Your assistant asks you questions and gives you a link. fooboard asks for your keys when you open it, so they never pass through the assistant.';

type Copied = 'link' | 'prompt';

/** What each copy button's status says once it has copied, or couldn't. */
const said = (what: Copied, ok: boolean): string =>
  ok
    ? `${what === 'link' ? 'Link' : 'Prompt'} copied.`
    : `Couldn't copy the ${what}. Select it above and copy it yourself.`;

/** A read-only field with its copy button and status. */
function CopyField({
  label,
  value,
  what,
}: {
  label: string;
  value: string;
  what: Copied;
}): React.JSX.Element {
  const id = useId();
  const [status, setStatus] = useState('');
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <div className="flex gap-2">
        <Input
          id={id}
          readOnly
          value={value}
          onFocus={(e) => {
            e.currentTarget.select();
          }}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-9 shrink-0 gap-1.5"
          onClick={() => {
            copyText(value, (ok) => {
              setStatus(said(what, ok));
            });
          }}
        >
          <Copy aria-hidden className="size-4" />
          {what === 'link' ? 'Copy link' : 'Copy prompt'}
        </Button>
      </div>
      <p role="status" className="min-h-4 text-xs text-muted-foreground">
        {status}
      </p>
    </div>
  );
}

export function AiSetupDialog({
  open,
  onOpenChange,
  onCloseAutoFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Where focus goes when it closes (it has no trigger of its own). */
  onCloseAutoFocus?: (event: Event) => void;
}): React.JSX.Element {
  const how = useId();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onCloseAutoFocus={onCloseAutoFocus} aria-describedby={how}>
        <DialogTitle>{AI_SETUP}</DialogTitle>
        <p id={how} className="text-sm text-muted-foreground">
          {AI_SETUP_HOW}
        </p>
        <CopyField
          label="Instructions for your assistant"
          value={site.aiUrl}
          what="link"
        />
        <CopyField label="A prompt to paste" value={AI_PROMPT} what="prompt" />
      </DialogContent>
    </Dialog>
  );
}
