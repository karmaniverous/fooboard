/**
 * *Post on X* (spec.md C-7, C-19): a plain outbound link to X's post
 * intent with `url`, styled as a button; no X script is loaded.
 *
 * @module
 */
import { XLogo } from '@/components/brandIcons';
import { ExternalLink } from '@/components/ExternalLink';
import { buttonVariants } from '@/components/ui/buttonVariants';
import { postUrl } from '@/lib/share';

export function PostOnX({
  url,
  children,
}: {
  /** The link the post carries. */
  url: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
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
      {children}
    </ExternalLink>
  );
}
