/**
 * What search engines, AI crawlers and link previews read without running
 * the app (spec 0.2.0 §3.K): `index.html`'s head (canonical address, Open
 * Graph and X card tags, the social image and the JSON-LD description,
 * every address on production's canonical host); the social image itself;
 * `robots.txt`, which lets every crawler in and names the sitemap; and
 * `sitemap.xml`, which lists the public pages, each of them served.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { PRODUCTION_ORIGIN } from '@/lib/productionOrigin';
import { site } from '@/lib/site';
import { DEMO_PATH, HOME_PATH } from '@/pages/paths';

import rewritesRaw from '../amplify-rewrites.json?raw';
import socialSource from '../docs/social/social-preview-dark.png?inline';
import html from '../index.html?raw';
import robots from '../public/robots.txt?raw';
import sitemap from '../public/sitemap.xml?raw';
import socialImage from '../public/social-preview.png?inline';
import { DEMO_HTML } from '../vite/demoPage';
import { parseRewrites, rewrite, SPA_ENTRY } from '../vite/hostingRules';

const head = new DOMParser().parseFromString(html, 'text/html').head;

/** The one value of `attribute` on the one element `selector` finds. */
function only(selector: string, attribute = 'content'): string {
  const found = head.querySelectorAll(selector);
  if (found.length !== 1)
    throw new Error(`${String(found.length)} of ${selector}, not one`);
  return found[0].getAttribute(attribute) ?? '';
}

/** The `<meta>` whose `property` or `name` is `key`. */
const meta = (key: string): string =>
  only(`meta[property="${key}"], meta[name="${key}"]`);

/** The site paths of the files in `public/`, which a build copies. */
const PUBLIC_FILES = Object.keys(
  import.meta.glob('../public/**', { query: '?raw' }),
).map((file) => file.slice('../public'.length));

/** Where the social image is served. */
const SOCIAL_IMAGE_PATH = '/social-preview.png';

/** A PNG's width and height, from its IHDR chunk (bytes 16 to 23). */
function pngSize(dataUrl: string): { width: number; height: number } {
  const bytes = Uint8Array.from(atob(dataUrl.split(',')[1]), (c) =>
    c.charCodeAt(0),
  );
  const view = new DataView(bytes.buffer);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

describe("index.html's head", () => {
  const home = `${PRODUCTION_ORIGIN}${HOME_PATH}`;
  const image = `${PRODUCTION_ORIGIN}${SOCIAL_IMAGE_PATH}`;

  it('names the home page on the canonical host as its address', () => {
    expect(only('link[rel="canonical"]', 'href')).toBe(home);
    expect(meta('og:url')).toBe(home);
  });

  it('gives link previews the title, description and type', () => {
    const title = head.querySelector('title')?.textContent;
    expect(meta('og:title')).toBe(title);
    expect(meta('twitter:title')).toBe(title);
    expect(meta('og:description')).toMatch(/\S/);
    expect(meta('twitter:description')).toBe(meta('og:description'));
    expect(meta('og:type')).toBe('website');
    expect(meta('og:site_name')).toBe(site.name);
    expect(meta('twitter:card')).toBe('summary_large_image');
    expect(meta('twitter:site')).toBe(site.xHandle);
  });

  it('points to the social image by its absolute address, with its size and text', () => {
    expect(meta('og:image')).toBe(image);
    expect(meta('twitter:image')).toBe(image);
    expect(meta('og:image:type')).toBe('image/png');
    const { width, height } = pngSize(socialImage);
    expect(Number(meta('og:image:width'))).toBe(width);
    expect(Number(meta('og:image:height'))).toBe(height);
    expect(meta('og:image:alt')).toMatch(/\S/);
    expect(meta('twitter:image:alt')).toBe(meta('og:image:alt'));
  });

  describe('the JSON-LD description', () => {
    const blocks = head.querySelectorAll('script[type="application/ld+json"]');
    const data: unknown = JSON.parse(
      blocks.length > 0 ? blocks[0].textContent : 'null',
    );

    it('is one block of JSON', () => {
      expect(blocks).toHaveLength(1);
      expect(data).toBeTypeOf('object');
    });

    it('describes fooboard as a free web application', () => {
      expect(data).toMatchObject({
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: site.name,
        applicationCategory: 'DeveloperApplication',
        operatingSystem: 'Any (runs in a web browser)',
        isAccessibleForFree: true,
        offers: { '@type': 'Offer', price: '0' },
        license: `https://spdx.org/licenses/${site.license}.html`,
        author: { '@type': 'Person', name: 'Jason Williscroft' },
        sameAs: [site.repoUrl, site.xUrl],
      });
      expect(data).toHaveProperty('description', expect.stringMatching(/\S/));
    });

    it('names the site and its image on the canonical host', () => {
      expect(data).toMatchObject({ url: home, image });
    });

    it('names an image the site serves', () => {
      expect(PUBLIC_FILES).toContain(new URL(image).pathname);
    });
  });
});

describe('the social image', () => {
  it('is the repository social preview, 1280 × 640', () => {
    expect(socialImage.split(',')[1]).toBe(socialSource.split(',')[1]);
    expect(pngSize(socialImage)).toEqual({ width: 1280, height: 640 });
  });
});

describe('robots.txt', () => {
  /** Its groups: the user agents each names, and its rules. */
  const groups = robots
    .split(/\n\s*\n/)
    .map((block) =>
      block
        .split('\n')
        .filter((line) => !line.startsWith('#') && line.includes(':'))
        .map((line) => {
          const [field, ...value] = line.split(':');
          return [field.trim().toLowerCase(), value.join(':').trim()];
        }),
    )
    .filter((lines) => lines.some(([field]) => field === 'user-agent'));

  /** The rules of the group naming `agent`. */
  const rulesFor = (agent: string): string[][] =>
    groups
      .find((lines) =>
        lines.some(
          ([field, value]) => field === 'user-agent' && value === agent,
        ),
      )
      ?.filter(([field]) => field !== 'user-agent') ?? [];

  it.each([
    '*',
    'GPTBot',
    'OAI-SearchBot',
    'ClaudeBot',
    'PerplexityBot',
    'Google-Extended',
    'Applebot-Extended',
    'CCBot',
  ])('lets %s crawl everything', (agent) => {
    expect(rulesFor(agent)).toEqual([['allow', '/']]);
  });

  it('names the sitemap on the canonical host', () => {
    expect(robots).toMatch(
      new RegExp(`^Sitemap: ${PRODUCTION_ORIGIN}/sitemap\\.xml$`, 'm'),
    );
  });
});

describe('sitemap.xml', () => {
  const doc = new DOMParser().parseFromString(sitemap, 'application/xml');
  const urls = [...doc.getElementsByTagName('loc')].map((loc) =>
    loc.textContent.trim(),
  );
  const { rewrites } = parseRewrites(rewritesRaw);

  it('is a sitemap', () => {
    expect(doc.getElementsByTagName('parsererror')).toHaveLength(0);
    expect(doc.documentElement.namespaceURI).toBe(
      'http://www.sitemaps.org/schemas/sitemap/0.9',
    );
  });

  it('lists the public pages on the canonical host', () => {
    expect(urls).toEqual(
      [HOME_PATH, DEMO_PATH, '/ai', '/llms.txt'].map(
        (path) => `${PRODUCTION_ORIGIN}${path}`,
      ),
    );
  });

  it('lists only pages the site serves: the page, the demo page or a file in public/', () => {
    const built = [SPA_ENTRY, `/${DEMO_HTML}`, ...PUBLIC_FILES];
    expect(
      urls.filter(
        (url) => !built.includes(rewrite(rewrites, new URL(url).pathname)),
      ),
    ).toEqual([]);
  });
});
