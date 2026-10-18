/**
 * The *Share / Export* dialog (spec.md C-19). Until share links and export
 * files ship (PR E) it shares the demo: the system share sheet where the
 * browser has one, *Copy link*, and *Post on X* (a plain outbound link,
 * no X script, C-7).
 *
 * @module
 */
import { Copy, Share2 } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { buttonVariants } from '@/components/ui/buttonVariants';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { copyText } from '@/lib/clipboard';
import { demoUrl, postUrl } from '@/lib/share';
import { site } from '@/lib/site';

import { XLogo } from './brandIcons';
import { ExternalLink } from './ExternalLink';

type Outcome = 'copied' | 'copyFailed' | 'shareFailed';

const SAID: Record<Outcome, string> = {
  copied: 'Link copied.',
  copyFailed: "Couldn't copy the link. Select it above and copy it yourself.",
  shareFailed: "Couldn't share. Copy the link instead.",
};

export function ShareDialog({
  open,
  onOpenChange,
  onCloseAutoFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Where focus goes when it closes (it has no trigger of its own). */
  onCloseAutoFocus?: (event: Event) => void;
}): React.JSX.Element {
  const url = demoUrl();
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const canShare = typeof navigator.share === 'function';
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOutcome(null);
        onOpenChange(next);
      }}
    >
      <DialogContent onCloseAutoFocus={onCloseAutoFocus}>
        <DialogTitle>Share {site.name}</DialogTitle>
        <p className="text-sm text-muted-foreground">
          Boards can&apos;t be shared yet, so share the demo.
        </p>
        <input
          readOnly
          aria-label="Demo link"
          value={url}
          onFocus={(e) => {
            e.currentTarget.select();
          }}
          className="h-9 rounded-md border border-border bg-muted px-2 text-sm"
        />
        <div className="flex flex-wrap gap-2">
          {canShare && (
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => {
                void navigator
                  .share({ title: site.name, text: site.tagline, url })
                  // Closing the sheet rejects with AbortError: nothing to
                  // report. Any other failure is said.
                  .catch((err: unknown) => {
                    if (!(
                      err instanceof DOMException && err.name === 'AbortError'
                    ))
                      setOutcome('shareFailed');
                  });
              }}
            >
              <Share2 aria-hidden className="size-4" />
              Share…
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => {
              void copyText(url).then((ok) => {
                setOutcome(ok ? 'copied' : 'copyFailed');
              });
            }}
          >
            <Copy aria-hidden className="size-4" />
            Copy link
          </Button>
          <ExternalLink
            unstyled
            href={postUrl(url)}
            className={buttonVariants({
              size: 'sm',
              variant: 'outline',
              className: 'gap-1.5',
            })}
          >
            <XLogo className="size-3.5" />
            Post on X
          </ExternalLink>
        </div>
        <p role="status" className="min-h-5 text-xs text-muted-foreground">
          {outcome && SAID[outcome]}
        </p>
      </DialogContent>
    </Dialog>
  );
}
