/**
 * The loading screen (spec 0.2.0 §3.J *The loading screen*, Decision 106):
 * `index.html`'s `#root` holds, as plain HTML, the product's name and
 * tagline and the assistant pointer as a link to `/ai`; it styles itself
 * only from the static stylesheet the CSP's `style-src 'self'` allows,
 * never by an inline `style` attribute or `<style>` element; and that
 * stylesheet keeps its pulse still under reduced motion and follows the
 * system's light or dark setting in the app's own theme colours, so the
 * swap to the app doesn't flash.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { site } from '@/lib/site';

import html from '../index.html?raw';
import css from '../public/loading.css?raw';
import theme from './index.css?raw';

const page = new DOMParser().parseFromString(html, 'text/html');
const root = page.getElementById('root');
const text = (el: Element | null | undefined) =>
  el?.textContent.replace(/\s+/g, ' ').trim();

/** The text of the `@media` block whose query matches `query` (up to
 * the next one), or of the rules before any. */
const mediaBlock = (query?: RegExp): string => {
  const [base, ...blocks] = css.split('@media');
  return query
    ? (blocks.find((part) => query.test(part.split('{')[0])) ?? '')
    : base;
};

/** A declaration's value in the first rule for `selector` in `text`. */
function declared(text: string, selector: string, property: string): string {
  const start = text.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`no ${selector} rule`);
  const body = text.slice(start, text.indexOf('}', start));
  const value = new RegExp(`(?:^|[\\s;])${property}:\\s*([^;]+);`).exec(body);
  if (!value) throw new Error(`no ${property} in ${selector}`);
  return value[1].trim();
}

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

  it('is styled only by the static stylesheet', () => {
    expect(page.querySelectorAll('[style]')).toHaveLength(0);
    expect(page.querySelectorAll('style, script:not([src])')).toHaveLength(0);
    expect(
      page.querySelector('link[rel="stylesheet"]')?.getAttribute('href'),
    ).toBe('/loading.css');
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
      expect(declared(block, '.loading-ai a', 'color')).toBe(
        token('foreground'),
      );
      expect(declared(block, '.loading-ai', 'color')).toBe(
        token('muted-foreground'),
      );
    },
  );
});
