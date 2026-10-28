/**
 * The committed Amplify Hosting configuration, read the way Amplify reads it
 * (spec.md §3.10, Decisions 24 and 40): the response headers of
 * `customHttp.yml` and the SPA rewrite of `amplify-rewrites.json`. One
 * source for both the hosted site and `vite preview`, so the CSP is tested
 * locally against the headers that ship.
 *
 * The parsers accept only the subset fooboard uses and throw on anything
 * else, so the local server can never quietly serve less than Amplify
 * would: one header pattern, `'**'` (every path), and 200 rewrites to the
 * page whose source is an Amplify regular expression (`</regex/>`).
 *
 * @module
 */
import { parse } from 'yaml';
import { z } from 'zod';

/** The only header pattern the local server reproduces: every path. */
export const EVERY_PATH = '**';

/** A header name: an HTTP token (RFC 9110 §5.6.2). */
const HTTP_TOKEN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;

/** The page every rewritten path is served. */
export const SPA_ENTRY = '/index.html';

const CustomHttpSchema = z.strictObject({
  customHeaders: z
    .array(
      z.strictObject({
        pattern: z.literal(EVERY_PATH),
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
    .length(1),
});

/** An Amplify regular-expression source: `</...regex.../>`. */
const REGEX_SOURCE = /^<\/(.+)\/>$/;

const RewritesSchema = z
  .array(
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
  )
  .min(1);

/** One 200 rewrite: the paths it matches are served its target. */
export interface Rewrite {
  /** The source's regular expression. */
  source: RegExp;
  /** Where a matching path is served from. */
  target: string;
}

/**
 * The response headers of a `customHttp.yml`, by header name.
 *
 * @throws When the file isn't the one-pattern shape described above, or
 * names a header twice (header names are case-insensitive).
 */
export function parseCustomHttp(text: string): Record<string, string> {
  const { customHeaders } = CustomHttpSchema.parse(parse(text));
  const headers: Record<string, string> = {};
  const seen = new Set<string>();
  for (const { key, value } of customHeaders[0].headers) {
    const name = key.toLowerCase();
    if (seen.has(name)) throw new Error(`Header ${key} is set twice`);
    seen.add(name);
    headers[key] = value;
  }
  return headers;
}

/**
 * The rewrites of an `amplify-rewrites.json`: the app's custom rules, as
 * the Amplify console's rewrites text editor and the CLI's
 * `update-app --custom-rules` take them.
 *
 * @throws When a rule isn't a 200 rewrite to {@link SPA_ENTRY} from an
 * Amplify regular expression.
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
 * rule serves the page for instead of the file. Must be empty for a build,
 * or the site would answer that file with the page.
 */
export function hiddenFiles(
  rules: readonly Rewrite[],
  paths: readonly string[],
): string[] {
  return paths.filter((path) => rewrite(rules, path) !== path);
}
