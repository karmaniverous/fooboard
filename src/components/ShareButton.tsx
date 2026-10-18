/**
 * The board's primary **Share** button (spec.md C-19, C-2a). Until share
 * links ship it shares the demo: the system share sheet where the browser
 * has one, *Copy link*, and *Post on X*, which opens X's compose page with
 * the tagline and the link (a plain link, no X script, C-7).
 *
 * @module
 */
import { Share2 } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { demoUrl, postUrl } from '@/lib/share';
import { site } from '@/lib/site';

import { ExternalLink } from './ExternalLink';

export function ShareButton(): React.JSX.Element {
  const url = demoUrl();
  const [copy, setCopy] = useState<
    'idle' | 'copied' | 'failed' | 'shareFailed'
  >('idle');
  /** Show a copy outcome on the button for a moment. */
  const flash = (outcome: 'copied' | 'failed' | 'shareFailed') => {
    setCopy(outcome);
    setTimeout(() => {
      setCopy('idle');
    }, 2000);
  };
  const canShare = typeof navigator.share === 'function';
  return (
    // Non-modal, like the header menu: no scroll lock, no layout shift.
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button size="sm" className="h-7 gap-1 px-2 text-xs">
          <Share2 aria-hidden className="size-3.5" />
          {copy === 'copied'
            ? 'Link copied'
            : copy === 'failed'
              ? "Couldn't copy"
              : copy === 'shareFailed'
                ? "Couldn't share"
                : 'Share'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {canShare && (
          <DropdownMenuItem
            onSelect={() => {
              void navigator
                .share({ title: site.name, text: site.tagline, url })
                // Closing the sheet rejects with AbortError: nothing to
                // report. Any other failure is said; Copy link remains.
                .catch((err: unknown) => {
                  if (!(
                    err instanceof DOMException && err.name === 'AbortError'
                  ))
                    flash('shareFailed');
                });
            }}
          >
            Share…
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          onSelect={() => {
            // No clipboard (an insecure page) or a refusal: say so.
            void Promise.resolve()
              .then(() => navigator.clipboard.writeText(url))
              .then(
                () => {
                  flash('copied');
                },
                () => {
                  flash('failed');
                },
              );
          }}
        >
          Copy link
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <ExternalLink unstyled href={postUrl(url)}>
            Post on X
          </ExternalLink>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
