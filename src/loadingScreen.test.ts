/**
 * The loading screen (spec 0.2.0 §3.J *The loading screen*, Decision 106):
 * `index.html`'s `#root` holds, as plain HTML, the product's name and
 * tagline and the assistant pointer as a link to `/ai`; it styles itself
 * only from the static stylesheet the CSP's `style-src 'self'` allows,
 * never by an inline `style` attribute or `<style>` element; and that
 * stylesheet keeps its pulse still under reduced motion and follows the
 * system's light or dark setting in the app's own theme colours, so the
 * swap to the app doesn't flash. Its paragraphs on what fooboard is, with
 * their links, are for readers that run no script (§3.K): hidden unless
 * scripting is off, in the same colours.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { site } from '@/lib/site';
import { DEMO_PATH } from '@/pages/paths';

import html from '../index.html?raw';
import css from '../public/loading.css?raw';
import theme from './index.css?raw';

const page = new DOMParser().parseFromString(html, 'text/html');
const root = page.getElementById('root');
const text = (el: Element | null | undefined) =>
  el?.textContent.replace(/\s+/g, ' ').trim();

/** `text` without its comments. */
const uncommented = (text: string): string =>
  text.replace(/\/\*[\s\S]*?\*\//g, '');

/** The text of the `@media` block whose query matches `query` (up to
 * the next one), or of the rules before any. */
const mediaBlock = (query?: RegExp): string => {
  const [base, ...blocks] = uncommented(css).split('@media');
  return query
    ? (blocks.find((part) => query.test(part.split('{')[0])) ?? '')
    : base;
};

/** A declaration's value in the first rule in `text` whose selector list
 * names `selector` (the selectors start after any at-rule statement) and
 * that declares `property`. */
function declared(text: string, selector: string, property: string): string {
  const declaration = new RegExp(`(?:^|[\\s;])${property}:\\s*([^;]+);`);
  const rules = [...uncommented(text).matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(
    ([, prelude]) =>
      (prelude.split(';').pop() ?? '')
        .split(',')
        .some((one) => one.trim() === selector),
  );
  if (rules.length === 0) throw new Error(`no ${selector} rule`);
  const value = rules
    .map(([, , body]) => declaration.exec(body)?.[1])
    .find((found) => found !== undefined);
  if (value === undefined) throw new Error(`no ${property} in ${selector}`);
  return value.trim();
}

/** Where scripting is off. */
const NO_SCRIPT = /scripting:\s*none/;

describe('the loading screen', () => {
  it('holds the name, the tagline and the /ai pointer as a link', () => {
    expect(text(root?.querySelector('h1'))).toBe(site.name);
    expect(text(root?.querySelector('.loading-tagline'))).toBe(site.tagline);
    const link = root?.querySelector('a');
    expect(link?.getAttribute('href')).toBe('/ai');
    expect(text(link)).toBe(site.aiUrl);
    expect(text(link?.parentElement)).toBe(
      `fooboard: a deployment status board. To set up a board with an AI assistant, read ${site.aiUrl}.`,
    );
  });

  it('says what fooboard is, with links to the demo, /ai, llms.txt, the repository and the article', () => {
    const about = root?.querySelector('.loading > .loading-about');
    expect(text(about)).toMatch(/GitHub Actions/);
    expect(text(about)).toMatch(/AWS Amplify/);
    expect(text(about)).toMatch(/behind, or has diverged from/);
    expect(text(about)).toMatch(/no backend, no account, no cookies/);
    expect(text(about)).toMatch(/never pass through the assistant/);
    expect(
      [...(about?.querySelectorAll('a') ?? [])].map((a) =>
        a.getAttribute('href'),
      ),
    ).toEqual([
      DEMO_PATH,
      '/ai',
      '/llms.txt',
      site.repoUrl,
      'https://karmanivero.us/welcome-to-devops-hell/',
    ]);
  });

  it('is styled only by the static stylesheet', () => {
    expect(page.querySelectorAll('[style]')).toHaveLength(0);
    // The JSON-LD block is data, never run (§3.K); any other inline
    // script would need the CSP's leave.
    expect(
      page.querySelectorAll(
        'style, script:not([src]):not([type="application/ld+json"])',
      ),
    ).toHaveLength(0);
    expect(
      [...page.querySelectorAll('link[rel="stylesheet"]')].map((link) =>
        link.getAttribute('href'),
      ),
    ).toEqual(['/loading.css']);
  });

  it('pulses, and keeps the pulse still under reduced motion', () => {
    expect(declared(mediaBlock(), '.loading-pulse', 'animation')).toMatch(
      /^loading-pulse /,
    );
    expect(
      declared(
        mediaBlock(/prefers-reduced-motion:\s*reduce/),
        '.loading-pulse',
        'animation',
      ),
    ).toBe('none');
  });

  it('shows what fooboard is only where scripting is off, without the pulse', () => {
    expect(declared(mediaBlock(), '.loading-about', 'display')).toBe('none');
    const noScript = mediaBlock(NO_SCRIPT);
    expect(declared(noScript, '.loading-about', 'display')).toBe('block');
    expect(declared(noScript, '.loading-pulse', 'display')).toBe('none');
    expect(declared(noScript, '.loading', 'overflow-y')).toBe('auto');
  });

  it.each([
    ['light', ':root', undefined],
    ['dark', '.dark', /prefers-color-scheme:\s*dark/],
  ])(
    "follows the system's %s setting in the app's colours",
    (_, tokens, query) => {
      const block = mediaBlock(query);
      const token = (name: string) => declared(theme, tokens, `--${name}`);
      expect(declared(block, '.loading', 'background-color')).toBe(
        token('background'),
      );
      expect(declared(block, '.loading', 'color')).toBe(token('foreground'));
      for (const part of ['.loading-ai', '.loading-about']) {
        expect(declared(block, `${part} a`, 'color')).toBe(token('foreground'));
        expect(declared(block, part, 'color')).toBe(token('muted-foreground'));
      }
    },
  );
});
