/**
 * The committed Amplify Hosting configuration, read the way Amplify reads it
 * (spec.md §3.10, Decisions 24 and 40; spec 0.2.0 §3.J *Serving them*):
 * the response headers of `customHttp.yml` and the rewrites of
 * `amplify-rewrites.json`. One source for both the hosted site and
 * `vite preview`, so the CSP is tested locally against the headers that
 * ship.
 *
 * The parsers accept only the subset fooboard uses and throw on anything
 * else, so the local server can never quietly serve less than Amplify
 * would: a first header pattern `'**'` (every path), then any number of
 * one-path patterns (`/ai`) that set no header `'**'` sets; and 200
 * rewrites, either to the page from an Amplify regular expression
 * (`</regex/>`) or from one plain path to one file (`/ai` → `/ai.md`).
 * Amplify merges the headers of every pattern a path matches, so a path
 * with a pattern of its own is served both.
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
const PATH_CHARS = String.raw`[^*?[\]{}<>!\s]*`;

/** One path, as a header pattern or a rewrite's plain source: starts with
 * `/` and holds no glob or regular-expression character. */
const ONE_PATH = new RegExp(`^/${PATH_CHARS}$`);

/** A file a plain rewrite serves: one path ending in an extension. */
const FILE_PATH = new RegExp(String.raw`^/${PATH_CHARS}\.[A-Za-z0-9]+$`);

/** The page every rewritten route is served. */
export const SPA_ENTRY = '/index.html';

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

/** An Amplify regular-expression source: `</...regex.../>`. */
const REGEX_SOURCE = /^<\/(.+)\/>$/;

/** `text` matched literally in a regular expression. */
const literal = (text: string): string =>
  text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

const RewritesSchema = z
  .array(
    z.union([
      z.strictObject({
        source: z.string().transform((source, ctx) => {
          const body = REGEX_SOURCE.exec(source)?.[1];
          if (body !== undefined) return new RegExp(body);
          ctx.addIssue({ code: 'custom', message: 'not a </regex/> source' });
          return z.NEVER;
        }),
        status: z.literal('200'),
        target: z.literal(SPA_ENTRY),
      }),
      z.strictObject({
        source: z
          .string()
          .regex(ONE_PATH, 'not a plain path')
          .transform((source) => new RegExp(`^${literal(source)}$`)),
        status: z.literal('200'),
        target: z.string().regex(FILE_PATH, 'not a file path'),
      }),
    ]),
  )
  .min(1);

/** One 200 rewrite: the paths it matches are served its target. */
export interface Rewrite {
  /** The source's regular expression. */
  source: RegExp;
  /** Where a matching path is served from. */
  target: string;
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

/**
 * The rewrites of an `amplify-rewrites.json`: the app's custom rules, as
 * the Amplify console's rewrites text editor and the CLI's
 * `update-app --custom-rules` take them.
 *
 * @throws When a rule is neither a 200 rewrite to {@link SPA_ENTRY} from
 * an Amplify regular expression nor a 200 rewrite from a plain path to a
 * file.
 */
export function parseRewrites(text: string): Rewrite[] {
  return RewritesSchema.parse(JSON.parse(text));
}

/** Where a request path is served from: the first matching rewrite's
 * target, or the path itself when none matches. */
export function rewrite(rules: readonly Rewrite[], path: string): string {
  return rules.find(({ source }) => source.test(path))?.target ?? path;
}

/**
 * The files a rewrite would hide: each site path (`/assets/x.js`) that a
 * rule serves something else for instead of the file. Must be empty for a
 * build, or the site would answer that file with the page.
 */
export function hiddenFiles(
  rules: readonly Rewrite[],
  paths: readonly string[],
): string[] {
  return paths.filter((path) => rewrite(rules, path) !== path);
}
