/**
 * GitHub `Link` header pagination (spec.md §5: `listBranches`, `listRepos`
 * are paginated). Parses the RFC 8288 `Link` header GitHub sends and drives
 * a page-by-page fetch until there is no `rel="next"` link.
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

/** One page of paginated results, plus the raw `Link` header that produced it. */
export interface Page<T> {
  items: T[];
  linkHeader: string | null;
}

/**
 * Follow `rel="next"` links starting at `firstUrl`, concatenating every
 * page's items. `fetchPage` performs one request (so caching, the serial
 * queue and budget tracking apply per page, like any other request).
 */
export async function paginateAll<T>(
  firstUrl: string,
  fetchPage: (url: string) => Promise<Page<T>>,
): Promise<T[]> {
  const items: T[] = [];
  let url: string | undefined = firstUrl;
  while (url) {
    const page: Page<T> = await fetchPage(url);
    items.push(...page.items);
    url = parseLinkHeader(page.linkHeader).next;
  }
  return items;
}
