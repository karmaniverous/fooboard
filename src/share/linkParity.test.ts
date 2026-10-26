/**
 * Tests that opening a share link and pasting it into the import dialog
 * read the same share (spec.md §3.8, Decision 69): for the same link text,
 * `takeShareLink` (opening) and `pastedLink` (pasting), each read by
 * `readLink`, give the same `ShareRead`, for a plain share, an encrypted
 * one, a damaged link and the shares a newer or another app made; pasted
 * text may be surrounded by whitespace, be the link at any path, or be
 * the fragment alone.
 *
 * Where they differ, by design: only opening clears the fragment (pinned
 * in `link.test.ts`), and text with no `#b=` is no share link when opened
 * (the page opens as usual) but a damaged one when pasted, since it was
 * pasted as one.
 *
 * @module
 */
import LZString from 'lz-string';
import { describe, expect, it } from 'vitest';

import { windowAt } from '@/test/linkWindow';
import { shareBoard } from '@/test/shareBoard';

import { buildEnvelope, type ShareRead } from './envelope';
import { pastedLink, shareLink, takeShareLink } from './link';
import { readLink } from './readLink';
import { encryptSecrets } from './secrets';

const board = shareBoard();
const HOME = 'https://fooboard.dev';
const at = (payload: string) => `${HOME}/#b=${payload}`;
/** The link holding `envelope`, as `shareLink` makes it, for any JSON. */
const linkOf = (envelope: unknown) =>
  at(LZString.compressToEncodedURIComponent(JSON.stringify(envelope)));
const gh = { 'gh-org': { kind: 'github', token: 'ghp_shared' } } as const;

/** Opening `url`: what `main.tsx` and a `hashchange` read. */
const opened = (url: string): ShareRead | null => {
  const taken = takeShareLink(windowAt(url), '/');
  return taken && readLink(taken);
};
/** Pasting `text` into the import dialog's link field. */
const pasted = (text: string): ShareRead => readLink(pastedLink(text));

/** The ways the same link may be pasted. */
const pastings = (url: string): [string, string][] => [
  ['as it is', url],
  ['between spaces and a line break', `  ${url}\n`],
  ['at another path', url.replace('/#', '/d/some-board#')],
  ['as the fragment alone', new URL(url).hash],
];

/** Each link, what opening it reads (`'ok'` or the refusal). */
const LINKS: [string, string, string][] = [
  ['a plain share', shareLink(buildEnvelope([board], null), HOME), 'ok'],
  [
    'a share with plain credentials',
    shareLink(buildEnvelope([board], { encrypted: false, secrets: gh }), HOME),
    'ok',
  ],
  [
    'an encrypted share',
    shareLink(
      buildEnvelope([board], await encryptSecrets(gh, 'opensesame', 1_000)),
      HOME,
    ),
    'ok',
  ],
  ['a link that will not decompress', at('%E2%98%83'), 'damaged'],
  [
    'a link holding no JSON',
    at(LZString.compressToEncodedURIComponent('{')),
    'damaged',
  ],
  [
    'a link from another app',
    linkOf({ format: 'other', formatVersion: 1 }),
    'notShare',
  ],
  [
    'a link from a newer fooboard',
    linkOf({ ...buildEnvelope([board], null), formatVersion: 99 }),
    'newer',
  ],
];

/** Text with no `#b=`: the URLs could be opened, the last only pasted. */
const NO_SHARE_URLS = [
  'https://fooboard.dev/demo',
  'https://fooboard.dev/#c=abc',
];
// A file's contents: the link field takes links, not files.
const FILE_TEXT = JSON.stringify(buildEnvelope([board], null));

describe('opening a share link and pasting it', () => {
  // Each case is what it says, so the comparisons below mean something.
  it.each(LINKS)('opening %s reads it as such', (_, url, outcome) => {
    const read = opened(url);
    expect(read && (read.ok ? 'ok' : read.reason)).toBe(outcome);
  });

  it.each(
    LINKS.flatMap(([what, url]) =>
      pastings(url).map(([how, text]) => [what, how, text, url]),
    ),
  )('%s, pasted %s, reads as opening it does', (_, __, text, url) => {
    expect(pasted(text)).toEqual(opened(url));
  });

  it.each(NO_SHARE_URLS)('opening %j finds no share link', (url) => {
    expect(opened(url)).toBeNull();
  });

  it.each([...NO_SHARE_URLS, FILE_TEXT])(
    'pasting %j, with no #b=, refuses it as a damaged link',
    (text) => {
      expect(pasted(text)).toEqual({ ok: false, reason: 'damaged' });
    },
  );
});
