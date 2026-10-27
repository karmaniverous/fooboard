/**
 * A changelog line's inline Markdown (spec.md C-20): `[text](https://…)`
 * links, `**strong**` and `*emphasis*`, as git-cliff writes scopes, the
 * breaking mark and PR links. Anything else is text; only `https:` links
 * become links, opened as every outbound link is (`ExternalLink`).
 *
 * @module
 */
import { ExternalLink } from '@/components/ExternalLink';

import { group } from './changelog';

const TOKEN =
  /\[([^\]]+)\]\((https:\/\/[^)\s]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*/g;

export function InlineMarkdown({ text }: { text: string }): React.JSX.Element {
  const parts: React.ReactNode[] = [];
  let at = 0;
  for (const m of text.matchAll(TOKEN)) {
    if (m.index > at) parts.push(text.slice(at, m.index));
    const [linkText, href, strong, em] = [1, 2, 3, 4].map((i) => group(m, i));
    const key = String(m.index);
    if (href !== undefined)
      parts.push(
        <ExternalLink key={key} href={href}>
          <InlineMarkdown text={linkText ?? href} />
        </ExternalLink>,
      );
    else if (strong !== undefined)
      parts.push(<strong key={key}>{strong}</strong>);
    else parts.push(<em key={key}>{em}</em>);
    at = m.index + m[0].length;
  }
  if (at < text.length) parts.push(text.slice(at));
  return <>{parts}</>;
}
