/**
 * *Set up with an AI assistant* (spec 0.2.0 §3.J *The dialog's layout,
 * revised*, *Copy buttons*; Decisions 90, 107 and 108): the title, how it
 * works, then exactly two rows. *Instructions for your assistant* holds
 * this site's `/ai` address with three icon buttons: open it in a new tab,
 * copy the address, and copy the full instructions (a line naming this
 * site, then its `/ai.md`, to paste where an assistant can't reach the
 * site). *Try this prompt*
 * holds "Follow the instructions at \{address\}" with a copy button. Every
 * button shows on every site. Opened from the navigation item and the
 * home page.
 *
 * @module
 */
import { ExternalLink as ExternalLinkIcon, Link } from 'lucide-react';
import { useEffect, useId } from 'react';

import { aiSetupFor, copiedInstructions, loadInstructions } from '@/ai/setup';
import {
  buttonVariants,
  ICON_BUTTON_CLASS,
} from '@/components/ui/buttonVariants';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { WithTooltip } from '@/components/ui/tooltip';

import { CopyButton } from './CopyButton';
import { ExternalLink } from './ExternalLink';

/** The dialog's title, the navigation item's label and the home page's
 * button (with an ellipsis there). */
export const AI_SETUP = 'Set up with an AI assistant';

/** How it works, under the title. */
export const AI_SETUP_HOW =
  'Your assistant asks you questions and gives you a link. fooboard asks for your keys when you open it, so they never pass through the assistant.';

/** The two rows' labels. */
export const AI_INSTRUCTIONS_LABEL = 'Instructions for your assistant';
export const AI_PROMPT_LABEL = 'Try this prompt';

/** The open button's name and tooltip. */
export const OPEN_INSTRUCTIONS = 'Open instructions in a new tab';

/** One row: its label, a read-only text box holding `value`, then its
 * buttons. */
function Row({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children: React.ReactNode;
}): React.JSX.Element {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <div className="flex items-center gap-1">
        <Input
          id={id}
          readOnly
          value={value}
          className="mr-1"
          onFocus={(e) => {
            e.currentTarget.select();
          }}
        />
        {children}
      </div>
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
  const { url, prompt } = aiSetupFor(origin);
  // Start loading the instructions as the dialog opens, so the click
  // copies them at once (a browser may refuse a copy long after it).
  useEffect(() => {
    if (open) load().catch(() => undefined);
  }, [open, load]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onCloseAutoFocus={onCloseAutoFocus} aria-describedby={how}>
        <DialogTitle>{AI_SETUP}</DialogTitle>
        <p id={how} className="text-sm text-muted-foreground">
          {AI_SETUP_HOW}
        </p>
        <Row label={AI_INSTRUCTIONS_LABEL} value={url}>
          <WithTooltip label={OPEN_INSTRUCTIONS}>
            <ExternalLink
              unstyled
              href={url}
              aria-label={OPEN_INSTRUCTIONS}
              className={buttonVariants({
                variant: 'ghost',
                className: ICON_BUTTON_CLASS,
              })}
            >
              <ExternalLinkIcon aria-hidden className="size-4" />
            </ExternalLink>
          </WithTooltip>
          <CopyButton
            label="Copy link"
            icon={Link}
            text={url}
            failed="Couldn't copy the link. Select it and copy it yourself."
          />
          <CopyButton
            label="Copy instructions"
            text={async () => copiedInstructions(origin, await load())}
            failed={`Couldn't copy the instructions. Open ${url} and copy them yourself.`}
          />
        </Row>
        <Row label={AI_PROMPT_LABEL} value={prompt}>
          <CopyButton
            label="Copy prompt"
            text={prompt}
            failed="Couldn't copy the prompt. Select it and copy it yourself."
          />
        </Row>
      </DialogContent>
    </Dialog>
  );
}
