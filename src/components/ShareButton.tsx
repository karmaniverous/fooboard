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
  const [copied, setCopied] = useState(false);
  const canShare = typeof navigator.share === 'function';
  return (
    // Non-modal, like the header menu: no scroll lock, no layout shift.
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button size="sm" className="h-7 gap-1 px-2 text-xs">
          <Share2 aria-hidden className="size-3.5" />
          {copied ? 'Link copied' : 'Share'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {canShare && (
          <DropdownMenuItem
            onSelect={() => {
              void navigator
                .share({ title: site.name, text: site.tagline, url })
                .catch(() => undefined);
            }}
          >
            Share…
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          onSelect={() => {
            void navigator.clipboard
              .writeText(url)
              .then(() => {
                setCopied(true);
                setTimeout(() => {
                  setCopied(false);
                }, 2000);
              })
              .catch(() => undefined);
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
