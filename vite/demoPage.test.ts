// @vitest-environment node
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { build } from 'vite';
import { describe, expect, it, vi } from 'vitest';

import { DEMO_HEAD, type PageHead } from '../src/lib/pageHead';
import {
  DEMO_HTML,
  demoPage,
  emitDemoPage,
  INDEX_HTML,
  withHead,
} from './demoPage';
import { read } from './serveProbe';

/** The committed page, without its module script (a build of it alone). */
const INDEX = read(INDEX_HTML);

/** The `content` of the `<meta>` whose `name` or `property` is `key`. */
const metaContent = (html: string, key: string): string | undefined =>
  new RegExp(`<meta\\s+(?:name|property)="${key}"\\s+content="([^"]*)"`).exec(
    html,
  )?.[1];

/** What the page's head says, tag by tag. */
const headOf = (html: string): Record<string, string | undefined> => ({
  title: /<title>([^<]*)<\/title>/.exec(html)?.[1],
  canonical: /<link\s+rel="canonical"\s+href="([^"]*)"/.exec(html)?.[1],
  ...Object.fromEntries(
    [
      'description',
      'og:title',
      'og:description',
      'og:url',
      'twitter:title',
      'twitter:description',
      'og:image',
      'twitter:image',
    ].map((key) => [key, metaContent(html, key)]),
  ),
});

describe('withHead', () => {
  it("gives every title, description and address tag the page's own", () => {
    const sample: PageHead = {
      title: 'T',
      description: 'for search',
      shareDescription: 'for previews',
      url: 'https://x.test/p',
    };
    expect(headOf(withHead(INDEX, sample))).toMatchObject({
      title: 'T',
      canonical: 'https://x.test/p',
      description: 'for search',
      'og:title': 'T',
      'og:description': 'for previews',
      'og:url': 'https://x.test/p',
      'twitter:title': 'T',
      'twitter:description': 'for previews',
    });
  });

  it('leaves the rest of the page as it is: the image, the JSON-LD, the body', () => {
    const page = withHead(INDEX, DEMO_HEAD);
    const before = headOf(INDEX);
    expect(headOf(page)['og:image']).toBe(before['og:image']);
    expect(headOf(page)['twitter:image']).toBe(before['twitter:image']);
    const after = (html: string) => html.slice(html.indexOf('<script'));
    expect(after(page)).toBe(after(INDEX));
  });

  it('escapes the values it writes', () => {
    const head: PageHead = {
      title: 'a <b> & "c"',
      description: "it's",
      shareDescription: 'x',
      url: 'https://x.test/?a=1&b=2',
    };
    const page = withHead(INDEX, head);
    expect(page).toContain('<title>a &lt;b&gt; &amp; &quot;c&quot;</title>');
    expect(page).toContain('content="it&#39;s"');
    expect(page).toContain('href="https://x.test/?a=1&amp;b=2"');
  });

  it.each([
    [
      'is missing',
      (html: string) => html.replace(/<link\s+rel="canonical"[^>]*>/, ''),
      '0 <link rel="canonical"> tags',
    ],
    [
      'is there twice',
      (html: string) =>
        html.replace(
          '<meta property="og:url"',
          '<meta property="og:url" content="x" /><meta property="og:url"',
        ),
      '2 <meta property="og:url"> tags',
    ],
  ])('refuses a page where a tag %s', (_why, change, message) => {
    expect(() => withHead(change(INDEX), DEMO_HEAD)).toThrow(message);
  });
});

describe('emitDemoPage', () => {
  /** Runs the hook over `bundle`; what it emitted. */
  const run = (bundle: Parameters<typeof emitDemoPage>[0]) => {
    const emitFile = vi.fn();
    const error = (message: string): never => {
      throw new Error(message);
    };
    emitDemoPage.call({ emitFile, error }, bundle);
    return emitFile.mock.calls;
  };

  it.each([
    ['text', INDEX],
    ['bytes', new TextEncoder().encode(INDEX)],
  ])('emits the demo page from the built page given as %s', (_how, source) => {
    expect(run({ [INDEX_HTML]: { type: 'asset', source } })).toEqual([
      [
        {
          type: 'asset',
          fileName: DEMO_HTML,
          source: withHead(INDEX, DEMO_HEAD),
        },
      ],
    ]);
  });

  it.each([
    ['no page', {}],
    ['a chunk by that name', { [INDEX_HTML]: { type: 'chunk' as const } }],
  ])('fails the build when it has %s', (_why, bundle) => {
    expect(() => run(bundle)).toThrow(
      `The build has no ${INDEX_HTML} to make ${DEMO_HTML} from`,
    );
  });
});

describe('a build with the plugin', () => {
  it("emits the demo's page beside the home page's", async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'fooboard-demo-page-'));
    try {
      writeFileSync(
        path.join(root, INDEX_HTML),
        INDEX.replace(/<script type="module"[^>]*><\/script>/, ''),
      );
      const result = await build({
        configFile: false,
        root,
        logLevel: 'silent',
        plugins: [demoPage()],
        build: { write: false },
      });
      const outputs = (Array.isArray(result) ? result : [result]).flatMap(
        (r) => ('output' in r ? r.output : []),
      );
      const page = (name: string) => {
        const file = outputs.find(({ fileName }) => fileName === name);
        return file?.type === 'asset' ? String(file.source) : '';
      };
      expect(headOf(page(DEMO_HTML)).title).toBe(DEMO_HEAD.title);
      expect(headOf(page(DEMO_HTML)).canonical).toBe(
        'https://www.fooboard.dev/demo',
      );
      expect(headOf(page(INDEX_HTML)).title).toBe(headOf(INDEX).title);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
