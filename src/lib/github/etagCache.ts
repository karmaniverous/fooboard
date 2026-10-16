/**
 * In-memory ETag cache (spec.md §5, C-16): one `EtagCache` belongs to one
 * credential's reader instance, so caching is inherently per
 * credential+URL. A `304 Not Modified` doesn't count against the primary
 * rate limit, so every GET sends `If-None-Match` when a cached entry exists
 * and reuses the cached body on a match.
 *
 * @module
 */

interface CacheEntry {
  etag: string;
  data: unknown;
  /** The original `Link` header: a 304 may omit it, but pagination needs it. */
  link: string | null;
}

/** Per-URL ETag + body cache, scoped to one credential. */
export class EtagCache {
  private readonly entries = new Map<string, CacheEntry>();

  /** The cached entry for `url`, if any. */
  get(url: string): CacheEntry | undefined {
    return this.entries.get(url);
  }

  /** Store (or replace) the cached entry for `url`. */
  set(url: string, entry: CacheEntry): void {
    this.entries.set(url, entry);
  }
}
