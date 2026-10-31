/**
 * The committed Amplify Hosting headers, read the way Amplify reads them
 * (spec.md §3.10, Decisions 24 and 40; spec 0.2.0 §3.J *Serving them*):
 * the response headers of `customHttp.yml`. One source for the hosted
 * site, `vite preview` and the dev server, so the CSP is tested locally
 * against the headers that ship. The rules of `amplify-rewrites.json` are
 * read by `hostingRules.ts`.
 *
 * The parser accepts only the subset fooboard uses and throws on anything
 * else, so the local server can never quietly serve less than Amplify
 * would: a first header pattern `'**'` (every path), then any number of
 * one-path patterns (`/ai`) that set no header `'**'` sets. Amplify
 * merges the headers of every pattern a path matches, so a path with a
 * pattern of its own is served both.
 *
 * @module
 */
import { parse } from 'yaml';
import { z } from 'zod';

/** The first header pattern, which every path matches. */
export const EVERY_PATH = '**';

/** A header name: an HTTP token (RFC 9110 §5.6.2). */
const HTTP_TOKEN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;

/** A path's characters: none a glob or Amplify regular expression uses. */
export const PATH_CHARS = String.raw`[^*?[\]{}<>!\s]*`;

/** One path, as a header pattern or a rewrite's plain source: starts with
 * `/` and holds no glob or regular-expression character. */
export const ONE_PATH = new RegExp(`^/${PATH_CHARS}$`);

const CustomHttpSchema = z.strictObject({
  customHeaders: z
    .array(
      z.strictObject({
        pattern: z.string().min(1),
        headers: z
          .array(
            z.strictObject({
              key: z.string().regex(HTTP_TOKEN, 'not a header name'),
              value: z.string().min(1),
            }),
          )
          .min(1),
      }),
    )
    .min(1),
});

/** Response headers, by header name. */
export type HeaderMap = Record<string, string>;

/** The headers of a `customHttp.yml`: those of `'**'`, and those of each
 * one-path pattern by its path. */
export interface HostingHeaders {
  /** The `'**'` pattern's headers, on every response. */
  every: HeaderMap;
  /** Each one-path pattern's own headers, by path. */
  byPath: Readonly<Record<string, HeaderMap>>;
}

/** One pattern's headers by name, refusing a header named twice (header
 * names are case-insensitive). */
function headerMap(
  entries: readonly { key: string; value: string }[],
): HeaderMap {
  const headers: HeaderMap = {};
  const seen = new Set<string>();
  for (const { key, value } of entries) {
    const name = key.toLowerCase();
    if (seen.has(name)) throw new Error(`Header ${key} is set twice`);
    seen.add(name);
    headers[key] = value;
  }
  return headers;
}

/**
 * The response headers of a `customHttp.yml`.
 *
 * @throws When the file isn't the shape described above: its first
 * pattern isn't `'**'`, a later one isn't one path, a path is named twice,
 * a one-path pattern sets a header `'**'` sets, or a pattern names a
 * header twice.
 */
export function parseCustomHttp(text: string): HostingHeaders {
  const [first, ...rest] = CustomHttpSchema.parse(parse(text)).customHeaders;
  if (first.pattern !== EVERY_PATH)
    throw new Error(`The first header pattern must be '${EVERY_PATH}'`);
  const every = headerMap(first.headers);
  const shared = new Set(Object.keys(every).map((k) => k.toLowerCase()));
  const byPath: Record<string, HeaderMap> = {};
  for (const { pattern, headers } of rest) {
    if (!ONE_PATH.test(pattern))
      throw new Error(`Header pattern ${pattern} is not one path`);
    if (pattern in byPath)
      throw new Error(`Header pattern ${pattern} is named twice`);
    const own = headerMap(headers);
    const repeated = Object.keys(own).find((k) => shared.has(k.toLowerCase()));
    if (repeated !== undefined)
      throw new Error(
        `Header ${repeated} of ${pattern} is set by '${EVERY_PATH}' too`,
      );
    byPath[pattern] = own;
  }
  return { every, byPath };
}

/** The headers a request for `path` is served: `'**'`'s, merged with
 * those of the pattern naming `path`, as Amplify merges them. */
export const headersFor = (
  hosting: HostingHeaders,
  path: string,
): HeaderMap => ({
  ...hosting.every,
  ...hosting.byPath[path],
});
