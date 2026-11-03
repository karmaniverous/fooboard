/**
 * Each page's head (spec 0.2.0 §3.K): its title, descriptions and
 * canonical address, and the tags that carry them. One source for the
 * static pages crawlers read (`index.html`, checked against
 * {@link HOME_HEAD} in `src/discovery.test.ts`, and the `demo.html` a build
 * writes, `vite/demoPage.ts`) and for the head the app sets as it moves
 * between routes (`useDocumentHead`). No browser globals, and only relative
 * imports with their extensions (as Vite's config loader wants), so the
 * Vite config reads it as well as the app.
 *
 * @module
 */
import { DEMO_PATH, HOME_PATH } from '../pages/paths.ts';
import { PRODUCTION_ORIGIN } from './productionOrigin.ts';

/** A page's own head: what a search result, a link preview and the
 * browser's tab show for it. */
export interface PageHead {
  /** The `<title>`, `og:title` and `twitter:title`. */
  title: string;
  /** The `description` meta tag, for search results. */
  description: string;
  /** `og:description` and `twitter:description`, for link previews. */
  shareDescription: string;
  /** Its canonical address (`<link rel="canonical">` and `og:url`). */
  url: string;
}

/** Product tagline (spec.md C-19); also the X bio. */
export const TAGLINE = "Welcome to DevOps hell. Here's your map.";

/** The pointer to the instructions for AI assistants (spec 0.2.0 §3.J
 * *Discovery*): the loading screen's sentence, ending the home page's
 * description and its link-preview description. */
const AI_POINTER = `fooboard: a deployment status board. To set up a board with an AI assistant, read ${PRODUCTION_ORIGIN}/ai.`;

/** The home page's head, and every route's but the demo's. */
export const HOME_HEAD: PageHead = {
  title: `fooboard: ${TAGLINE}`,
  description: `${TAGLINE} A free, open-source, client-only browser app showing the deployment state of every repo x stage at a glance. ${AI_POINTER}`,
  shareDescription: AI_POINTER,
  url: `${PRODUCTION_ORIGIN}${HOME_PATH}`,
};

/** The demo's description, for search results and link previews alike. */
const DEMO_DESCRIPTION =
  'Try fooboard with no account or token: a demo board for a fictional company, acme, reading a GitHub and an AWS simulated in your browser, so nothing leaves it.';

/** The demo's head. */
export const DEMO_HEAD: PageHead = {
  title: 'fooboard demo: a simulated deployment status board',
  description: DEMO_DESCRIPTION,
  shareDescription: DEMO_DESCRIPTION,
  url: `${PRODUCTION_ORIGIN}${DEMO_PATH}`,
};

/** The head of the page at `pathname`: the demo's, or the home page's. */
export const headFor = (pathname: string): PageHead =>
  pathname === DEMO_PATH ? DEMO_HEAD : HOME_HEAD;

/** One `<meta>` tag a page gives its own value: its `name` or `property`
 * attribute, its key, and the field of {@link PageHead} it carries. */
export interface HeadMeta {
  attribute: 'name' | 'property';
  key: string;
  field: keyof PageHead;
}

/** Every `<meta>` tag a page gives its own value (besides `<title>` and
 * the canonical link). */
export const HEAD_META: readonly HeadMeta[] = [
  { attribute: 'name', key: 'description', field: 'description' },
  { attribute: 'property', key: 'og:title', field: 'title' },
  { attribute: 'property', key: 'og:description', field: 'shareDescription' },
  { attribute: 'property', key: 'og:url', field: 'url' },
  { attribute: 'name', key: 'twitter:title', field: 'title' },
  { attribute: 'name', key: 'twitter:description', field: 'shareDescription' },
];
