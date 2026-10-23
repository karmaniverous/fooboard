/**
 * GitHub `Link` header pagination (spec.md §3.1): parse the RFC 8288
 * `Link` header GitHub sends, so a page can say whether its list goes on.
 * Each page is its own query.
 *
 * @module
 */

/** Parse a `Link` header into a map of `rel` to URL (e.g. `{ next, last }`). */
export function parseLinkHeader(header: string | null): Record<string, string> {
  if (!header) return {};
  const links: Record<string, string> = {};
  for (const part of header.split(',')) {
    const match = /<([^>]+)>;\s*rel="([^"]+)"/.exec(part.trim());
    if (match) links[match[2]] = match[1];
  }
  return links;
}
