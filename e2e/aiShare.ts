/**
 * For the e2e tests: the share of `/ai`'s first worked example (spec
 * 0.2.0 §3.J), one dashboard with one credential and no secrets, as an
 * assistant builds it, with its board's path and its credential's label; the
 * example's own `#j=` link; and a refused share, whose import lists
 * errors.
 *
 * @module
 */
import { readFileSync } from 'node:fs';

import { z } from 'zod';

const AI_MD = readFileSync('public/ai.md', 'utf8');

/** The first worked example's JSON, as `/ai` gives it. */
export const AI_SHARE_JSON = /```json\n(\{\n {2}"format"[\s\S]*?)\n```/.exec(
  AI_MD,
)?.[1];

const { dashboards } = z
  .object({
    dashboards: z
      .array(
        z.object({
          id: z.string(),
          credentials: z.array(z.object({ label: z.string() })).length(1),
        }),
      )
      .length(1),
  })
  .parse(JSON.parse(AI_SHARE_JSON ?? 'null'));

/** Where the example dashboard's board opens once imported. */
export const AI_BOARD_PATH = `/d/${dashboards[0].id}`;
/** Its one credential's label, the name of its item in the panel. */
export const AI_CREDENTIAL = dashboards[0].credentials[0].label;

/** The example's link, at its fragment. */
export const AI_LINK_FRAGMENT =
  /https:\/\/www\.fooboard\.dev\/(#j=[A-Za-z0-9_-]+)/.exec(AI_MD)?.[1] ?? '';

/** The `#j=` fragment holding `json`: UTF-8, base64url, unpadded. */
const jsonFragment = (json: string): string =>
  `#j=${Buffer.from(json, 'utf8').toString('base64url')}`;

/** A share with no `schemaVersion`, `dashboards` or `credentials`. */
export const REFUSED_FRAGMENT = jsonFragment(
  JSON.stringify({ format: 'fooboard-share', formatVersion: 1 }),
);
