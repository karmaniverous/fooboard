/**
 * The demo's own page (spec 0.2.0 §3.K): a build emits `demo.html`, the
 * built `index.html` with the demo's title, description, Open Graph and X
 * card text, and canonical address, so `/demo` (rewritten to `/demo.html`
 * by `amplify-rewrites.json`) tells crawlers and link previews what it is
 * rather than repeating the home page's. The app is the same: the page
 * loads the same scripts, and the router shows the demo at `/demo`.
 *
 * The head is rewritten tag by tag ({@link withHead}), each tag found
 * exactly once as `index.html` writes it, or the build fails, so the demo's
 * page can never quietly keep a home-page tag. The values and the list of
 * tags are `src/lib/pageHead.ts`'s, which the app also sets as it moves
 * between routes.
 *
 * @module
 */
import type { Plugin } from 'vite';

import { DEMO_HEAD, HEAD_META, type PageHead } from '../src/lib/pageHead.ts';

/** The built page every other page starts from. */
export const INDEX_HTML = 'index.html';

/** The demo's page in the build, which `/demo` is served. */
export const DEMO_HTML = 'demo.html';

/** `text` as an HTML attribute value or element text. */
const escapeHtml = (text: string): string =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** One tag of the head, how `index.html` writes it, and what replaces it. */
interface HeadTag {
  /** Names the tag in an error. */
  name: string;
  /** Matches the tag (no flags). */
  pattern: RegExp;
  /** The tag with the page's value. */
  replacement: string;
}

/** A `<meta>` tag by its `name` or `property` attribute, written before
 * its `content`, as in `index.html`. */
const meta = (
  attribute: 'name' | 'property',
  key: string,
  content: string,
): HeadTag => ({
  name: `<meta ${attribute}="${key}">`,
  pattern: new RegExp(
    `<meta\\s+${attribute}="${key}"\\s+content="[^"]*"\\s*/?>`,
  ),
  replacement: `<meta ${attribute}="${key}" content="${escapeHtml(content)}" />`,
});

/** Every tag of the head a page gives its own value. */
const headTags = (head: PageHead): HeadTag[] => [
  {
    name: '<title>',
    pattern: /<title>[^<]*<\/title>/,
    replacement: `<title>${escapeHtml(head.title)}</title>`,
  },
  {
    name: '<link rel="canonical">',
    pattern: /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/,
    replacement: `<link rel="canonical" href="${escapeHtml(head.url)}" />`,
  },
  ...HEAD_META.map(({ attribute, key, field }) =>
    meta(attribute, key, head[field]),
  ),
];

/**
 * `html` with `head`'s title, description and address in every tag that
 * carries them.
 *
 * @throws When `html` doesn't have exactly one of a tag.
 */
export function withHead(html: string, head: PageHead): string {
  return headTags(head).reduce((page, { name, pattern, replacement }) => {
    const found = page.match(new RegExp(pattern.source, 'g'))?.length ?? 0;
    if (found !== 1)
      throw new Error(
        `${INDEX_HTML} has ${String(found)} ${name} tags, not one: the demo's page can't be built from it`,
      );
    return page.replace(pattern, () => replacement);
  }, html);
}

/** An emitted asset's text. */
const text = (source: string | Uint8Array): string =>
  typeof source === 'string' ? source : new TextDecoder().decode(source);

/** The parts of a bundle output the plugin reads. */
interface Output {
  type: 'chunk' | 'asset';
  source?: string | Uint8Array;
}

/** What the plugin's hook needs of Vite's plugin context. */
interface Context {
  emitFile: (file: {
    type: 'asset';
    fileName: string;
    source: string;
  }) => unknown;
  error: (message: string) => never;
}

/** Emits {@link DEMO_HTML} beside the built `index.html` (see the
 * module); `bundle` is the build's output so far. */
export function emitDemoPage(
  this: Context,
  bundle: Readonly<Partial<Record<string, Output>>>,
): void {
  const index = bundle[INDEX_HTML];
  if (index?.type !== 'asset' || index.source === undefined)
    this.error(`The build has no ${INDEX_HTML} to make ${DEMO_HTML} from`);
  this.emitFile({
    type: 'asset',
    fileName: DEMO_HTML,
    source: withHead(text(index.source), DEMO_HEAD),
  });
}

/** The Vite plugin: builds only, after Vite has written `index.html`. */
export function demoPage(): Plugin {
  return {
    name: 'fooboard:demo-page',
    apply: 'build',
    generateBundle: {
      order: 'post',
      handler(_options, bundle) {
        emitDemoPage.call(this, bundle);
      },
    },
  };
}
