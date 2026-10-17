/**
 * App footer: outbound links only (no embedded widgets, per spec.md C-7/C-19).
 *
 * @module
 */
import { ExternalLink } from '@/components/ExternalLink';
import { site } from '@/lib/site';
import { PINNED_FULL } from '@/lib/utils';

export function Footer(): React.JSX.Element {
  return (
    <footer
      className={`${PINNED_FULL} border-t border-border px-5 py-5 text-center text-xs text-muted-foreground`}
    >
      <p>
        {site.name} &middot; static, browser-only, no servers &middot;{' '}
        {site.license}
      </p>
      <p className="mt-1">
        <ExternalLink href={site.xUrl}>
          News &amp; support on X {site.xHandle}
        </ExternalLink>
        {' · '}
        <ExternalLink href={site.issuesUrl}>Report an issue</ExternalLink>
      </p>
    </footer>
  );
}
