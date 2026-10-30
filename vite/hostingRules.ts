/**
 * The committed Amplify Hosting rules, read the way Amplify reads them
 * (spec.md §3.10, Decision 40; spec 0.2.0 §3.J *Serving them*): the
 * console's whole list of rules in `amplify-rewrites.json`. One source
 * for the hosted site, `vite preview` and the dev server.
 *
 * The parser accepts only the subset fooboard uses and throws on anything
 * else, so the local server can never quietly serve less than Amplify
 * would: the console's whole list of rules, in order (Decision 110):
 * redirects first (301, 302 or 307, from a plain path or a full URL such
 * as the apex `https://fooboard.dev`, to a path or a URL), then 200
 * rewrites from one plain path to one file (`/ai` → `/ai.md`), then 200
 * rewrites to the page from an Amplify regular expression (`</regex/>`),
 * the SPA rule.
 *
 * @module
 */
import { z } from 'zod';

import { ONE_PATH, PATH_CHARS } from './hosting.ts';

/** A file a plain rewrite serves: one path ending in an extension. */
const FILE_PATH = new RegExp(String.raw`^/${PATH_CHARS}\.[A-Za-z0-9]+$`);

/** The page every rewritten route is served. */
export const SPA_ENTRY = '/index.html';

/** An Amplify regular-expression source: `</...regex.../>`. */
const REGEX_SOURCE = /^<\/(.+)\/>$/;

/** `text` matched literally in a regular expression. */
const literal = (text: string): string =>
  text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

/** The statuses a redirect rule may have: permanent (301), temporary
 * (302) and temporary keeping the method (307). */
export const REDIRECT_STATUSES = ['301', '302', '307'] as const;

/** A redirect rule's status. */
export type RedirectStatus = (typeof REDIRECT_STATUSES)[number];

/** Whether `text` is an absolute `http:` or `https:` URL. */
const isHttpUrl = (text: string): boolean =>
  /^https?:\/\//.test(text) && URL.canParse(text);

/** Whether `text` is one plain path or an absolute http(s) URL: a
 * redirect's source or target. */
const isPathOrUrl = (text: string): boolean =>
  ONE_PATH.test(text) || isHttpUrl(text);

/** One redirect: a request for its path is answered its status, with its
 * target as the `Location`. */
export interface Redirect {
  /** The plain path it matches; undefined when its source is a full URL
   * (a host's redirect, such as the apex's, which a local server never
   * receives). */
  path: string | undefined;
  /** The response status. */
  status: RedirectStatus;
  /** The `Location`: a URL or a path. */
  target: string;
}

/** One 200 rewrite: the paths it matches are served its target. */
export interface Rewrite {
  /** The source's regular expression. */
  source: RegExp;
  /** Where a matching path is served from. */
  target: string;
}

/** The kinds of rule, in the order the list must give them. */
const RULE_ORDER = ['redirect', 'file', 'page'] as const;

/** Each kind of rule, as the order check names it. */
const RULE_NAMES: Record<(typeof RULE_ORDER)[number], string> = {
  redirect: 'a redirect',
  file: 'a one-path rewrite',
  page: 'the SPA rule',
};

const RewritesSchema = z
  .array(
    z.union([
      z
        .strictObject({
          source: z
            .string()
            .refine(isPathOrUrl, 'not a plain path or an http(s) URL'),
          status: z.enum(REDIRECT_STATUSES),
          target: z
            .string()
            .refine(isPathOrUrl, 'not a plain path or an http(s) URL'),
        })
        .transform(({ source, status, target }) => ({
          kind: 'redirect' as const,
          redirect: {
            path: ONE_PATH.test(source) ? source : undefined,
            status,
            target,
          },
        })),
      z
        .strictObject({
          source: z
            .string()
            .regex(ONE_PATH, 'not a plain path')
            .transform((source) => new RegExp(`^${literal(source)}$`)),
          status: z.literal('200'),
          target: z.string().regex(FILE_PATH, 'not a file path'),
        })
        .transform(({ source, target }) => ({
          kind: 'file' as const,
          rewrite: { source, target },
        })),
      z
        .strictObject({
          source: z.string().transform((source, ctx) => {
            const body = REGEX_SOURCE.exec(source)?.[1];
            if (body !== undefined) return new RegExp(body);
            ctx.addIssue({ code: 'custom', message: 'not a </regex/> source' });
            return z.NEVER;
          }),
          status: z.literal('200'),
          target: z.literal(SPA_ENTRY),
        })
        .transform(({ source, target }) => ({
          kind: 'page' as const,
          rewrite: { source, target },
        })),
    ]),
  )
  .min(1)
  .superRefine((rules, ctx) => {
    rules.slice(1).forEach(({ kind }, i) => {
      const before = rules[i].kind;
      if (RULE_ORDER.indexOf(kind) < RULE_ORDER.indexOf(before))
        ctx.addIssue({
          code: 'custom',
          path: [i + 1],
          message: `Rule ${String(i + 2)}, ${RULE_NAMES[kind]}, follows ${RULE_NAMES[before]}: list the redirects first, then the one-path rewrites, then the SPA rule`,
        });
    });
  })
  .transform((rules): HostingRules => ({
    redirects: rules.flatMap((rule) =>
      rule.kind === 'redirect' ? [rule.redirect] : [],
    ),
    rewrites: rules.flatMap((rule) =>
      rule.kind === 'redirect' ? [] : [rule.rewrite],
    ),
  }));

/** The rules of an `amplify-rewrites.json`, each kind in its order. */
export interface HostingRules {
  /** The redirects, answered before any rewrite. */
  redirects: Redirect[];
  /** The 200 rewrites: the one-path rewrites, then the SPA rule. */
  rewrites: Rewrite[];
}

/**
 * The rules of an `amplify-rewrites.json`: the app's whole list of custom
 * rules, redirects included, as the Amplify console's rewrites text editor
 * and the CLI's `update-app --custom-rules` take them (Decision 110).
 *
 * @throws When a rule is none of a redirect (status in
 * {@link REDIRECT_STATUSES}, from a plain path or an http(s) URL to either),
 * a 200 rewrite from a plain path to a file and a 200 rewrite to
 * {@link SPA_ENTRY} from an Amplify regular expression; or when the rules
 * aren't in that order.
 */
export function parseRewrites(text: string): HostingRules {
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
