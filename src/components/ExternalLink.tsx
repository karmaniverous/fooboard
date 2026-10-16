/**
 * ExternalLink: an anchor that opens in a new tab with
 * `rel="noopener noreferrer"` and the app's standard underlined link
 * style. Use it for every outbound link so the security attributes are
 * never forgotten.
 *
 * @module
 */
import type { AnchorHTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

type ExternalLinkProps = Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  'target' | 'rel'
> & { href: string };

export function ExternalLink({
  className,
  ...props
}: ExternalLinkProps): React.JSX.Element {
  return (
    <a
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'underline underline-offset-2 hover:text-foreground',
        className,
      )}
      {...props}
    />
  );
}
