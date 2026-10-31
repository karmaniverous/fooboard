/**
 * An icon-only copy button (spec 0.2.0 §3.J *Copy buttons*, Decision
 * 108): a ghost button in the header's style, named by what it copies,
 * with that name as its tooltip. After a copy its icon becomes a green
 * check for `COPIED_FEEDBACK_MS`, then returns; there is no visible
 * "copied" text, and a polite live region says "Copied" for screen
 * readers. A failed copy leaves the icon and announces the failure.
 *
 * Used by *Set up with an AI assistant*; conforming the app's other copy
 * buttons is #63.
 *
 * @module
 */
import { Check, Copy, type LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { ICON_BUTTON_CLASS } from '@/components/ui/buttonVariants';
import { WithTooltip } from '@/components/ui/tooltip';
import { copyText } from '@/lib/clipboard';

/** How long the green check stays after a copy: long enough to see,
 * short enough that a second copy shows a fresh one. */
export const COPIED_FEEDBACK_MS = 2_000;

/** What the live region says after a copy. */
export const COPIED = 'Copied';

/** What the button shows and its live region says. */
type Outcome = 'idle' | 'copied' | 'failed';

export function CopyButton({
  label,
  text,
  failed,
  icon: Icon = Copy,
}: {
  /** Its accessible name and tooltip: what it copies (*Copy link*). */
  label: string;
  /** What it copies, or how to get it (loaded when clicked). */
  text: string | (() => Promise<string>);
  /** What the live region says when the copy fails. */
  failed: string;
  /** Its icon at rest. */
  icon?: LucideIcon;
}): React.JSX.Element {
  const [outcome, setOutcome] = useState<Outcome>('idle');

  useEffect(() => {
    if (outcome !== 'copied') return;
    const timer = window.setTimeout(() => {
      setOutcome('idle');
    }, COPIED_FEEDBACK_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [outcome]);

  const say = (ok: boolean) => {
    setOutcome(ok ? 'copied' : 'failed');
  };

  // Back to rest first, so a second copy restarts the check's timer.
  const copy = () => {
    setOutcome('idle');
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

  const announced =
    outcome === 'copied' ? COPIED : outcome === 'failed' ? failed : '';

  return (
    <>
      <WithTooltip label={label}>
        <Button
          type="button"
          variant="ghost"
          aria-label={label}
          className={ICON_BUTTON_CLASS}
          onClick={copy}
        >
          {outcome === 'copied' ? (
            <Check
              aria-hidden
              data-copied=""
              className="size-4 text-status-success"
            />
          ) : (
            <Icon aria-hidden className="size-4" />
          )}
        </Button>
      </WithTooltip>
      <span role="status" className="sr-only">
        {announced}
      </span>
    </>
  );
}
