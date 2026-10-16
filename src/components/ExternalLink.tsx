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
> & {
  href: string | undefined;
  /** Skip the underlined text-link style (cells, badges, menu items). */
  unstyled?: boolean;
};

export function ExternalLink({
  className,
  unstyled = false,
  ...props
}: ExternalLinkProps): React.JSX.Element {
  return (
    <a
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        !unstyled && 'underline underline-offset-2 hover:text-foreground',
        className,
      )}
      {...props}
    />
  );
}
