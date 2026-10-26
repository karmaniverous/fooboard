/**
 * Sharing the demo (spec.md C-19, §2.10, kept beside board sharing by
 * §3.8): the system share sheet where the browser has one, *Copy link*,
 * and *Post on X* (a plain outbound link, no X script, C-7).
 *
 * @module
 */
import { Copy, Share2 } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { copyText } from '@/lib/clipboard';
import { demoUrl } from '@/lib/share';
import { site } from '@/lib/site';

import { PostOnX } from './PostOnX';

type Outcome = 'copied' | 'copyFailed' | 'shareFailed';

const SAID: Record<Outcome, string> = {
  copied: 'Link copied.',
  copyFailed: "Couldn't copy the link. Select it above and copy it yourself.",
  shareFailed: "Couldn't share. Copy the link instead.",
};

export function DemoShare(): React.JSX.Element {
  const url = demoUrl();
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const canShare = typeof navigator.share === 'function';
  return (
    <section aria-labelledby="share-demo" className="flex flex-col gap-2">
      <h3 id="share-demo" className="text-sm font-semibold">
        The demo
      </h3>
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
            copyText(url, (ok) => {
              setOutcome(ok ? 'copied' : 'copyFailed');
            });
          }}
        >
          <Copy aria-hidden className="size-4" />
          Copy link
        </Button>
        <PostOnX url={url}>Post on X</PostOnX>
      </div>
      <p role="status" className="min-h-5 text-xs text-muted-foreground">
        {outcome && SAID[outcome]}
      </p>
    </section>
  );
}
