/**
 * *Set up with an AI assistant* (spec 0.2.0 §3.J *The dialog*; Decisions
 * 90 and 107): the address of this site's instructions for assistants
 * with *Copy link*, a ready prompt with *Copy prompt*, and one line on how
 * it works. Off production, which no assistant can reach, one more line
 * says so and *Copy instructions* copies this site's `/ai.md` to paste
 * instead, and the prompt refers to the pasted text (`aiSetupFor`).
 * Opened from the navigation item and the home page.
 *
 * @module
 */
import { Copy } from 'lucide-react';
import { useEffect, useId, useState } from 'react';

import { aiSetupFor, loadInstructions } from '@/ai/setup';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { copyText } from '@/lib/clipboard';

/** The dialog's title, the navigation item's label and the home page's
 * button (with an ellipsis there). */
export const AI_SETUP = 'Set up with an AI assistant';

/** How it works, under the title. */
export const AI_SETUP_HOW =
  'Your assistant asks you questions and gives you a link. fooboard asks for your keys when you open it, so they never pass through the assistant.';

/** Off production: why the instructions are copied rather than linked. */
export const AI_SETUP_UNREACHABLE =
  "An assistant can't reach this site: copy its instructions, paste them into your assistant, then paste the prompt.";

const BUTTON_CLASS = 'h-9 shrink-0 gap-1.5';

/** A copy button's status line and its click: copies `text` (or what
 * `text` loads), then says `copied` or `failed`. */
function useCopy(
  text: string | (() => Promise<string>),
  copied: string,
  failed: string,
): [status: string, copy: () => void] {
  const [status, setStatus] = useState('');
  const say = (ok: boolean) => {
    setStatus(ok ? copied : failed);
  };
  const copy = () => {
    if (typeof text === 'string') copyText(text, say);
    else
      text().then(
        (loaded) => {
          copyText(loaded, say);
        },
        () => {
          say(false);
        },
      );
  };
  return [status, copy];
}

/** A copy button with its icon. */
function CopyButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}): React.JSX.Element {
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className={BUTTON_CLASS}
      onClick={onClick}
    >
      <Copy aria-hidden className="size-4" />
      {label}
    </Button>
  );
}

/** A status line under a copy button. */
const Status = ({ text }: { text: string }): React.JSX.Element => (
  <p role="status" className="min-h-4 text-xs text-muted-foreground">
    {text}
  </p>
);

/** A read-only field with its copy button and status. */
function CopyField({
  label,
  value,
  what,
}: {
  label: string;
  value: string;
  what: 'link' | 'prompt';
}): React.JSX.Element {
  const id = useId();
  const [status, copy] = useCopy(
    value,
    `${what === 'link' ? 'Link' : 'Prompt'} copied.`,
    `Couldn't copy the ${what}. Select it above and copy it yourself.`,
  );
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
        <CopyButton
          label={what === 'link' ? 'Copy link' : 'Copy prompt'}
          onClick={copy}
        />
      </div>
      <Status text={status} />
    </div>
  );
}

/** Off production: the line saying an assistant can't reach this site,
 * and *Copy instructions*. The instructions start loading as it shows, so
 * the click copies them at once. */
function CopyInstructions({
  url,
  load,
}: {
  url: string;
  load: () => Promise<string>;
}): React.JSX.Element {
  const [status, copy] = useCopy(
    load,
    'Instructions copied. Paste them into your assistant, then the prompt.',
    `Couldn't copy the instructions. Open ${url} and copy them yourself.`,
  );
  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);
  return (
    <div className="flex flex-col gap-1">
      <p className="text-sm">{AI_SETUP_UNREACHABLE}</p>
      <div>
        <CopyButton label="Copy instructions" onClick={copy} />
      </div>
      <Status text={status} />
    </div>
  );
}

export function AiSetupDialog({
  open,
  onOpenChange,
  onCloseAutoFocus,
  origin = window.location.origin,
  load = loadInstructions,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Where focus goes when it closes (it has no trigger of its own). */
  onCloseAutoFocus?: (event: Event) => void;
  /** The site it runs on (this page's, unless a test says otherwise). */
  origin?: string;
  /** Loads this site's instructions for *Copy instructions*. */
  load?: () => Promise<string>;
}): React.JSX.Element {
  const how = useId();
  const setup = aiSetupFor(origin);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onCloseAutoFocus={onCloseAutoFocus} aria-describedby={how}>
        <DialogTitle>{AI_SETUP}</DialogTitle>
        <p id={how} className="text-sm text-muted-foreground">
          {AI_SETUP_HOW}
        </p>
        <CopyField
          label="Instructions for your assistant"
          value={setup.url}
          what="link"
        />
        {!setup.reachable && <CopyInstructions url={setup.url} load={load} />}
        <CopyField
          label="A prompt to paste"
          value={setup.prompt}
          what="prompt"
        />
      </DialogContent>
    </Dialog>
  );
}
