/**
 * Tests for `#j=` links (spec 0.2.0 §3.J *`#j=` links*): the share's JSON
 * in the fragment, as an assistant builds one. Every form `/ai` allows
 * and the decoder forgives (base64url or standard, padded or not;
 * percent-encoded or raw JSON) reads the same share as the `#b=` link
 * fooboard makes; raw JSON holding a literal `%` reads; a pasted link is
 * cut where it ends, raw JSON at its balancing brace; and a payload that
 * isn't base64 or UTF-8 is refused as damaged.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { windowAt } from '@/test/linkWindow';
import { shareBoard } from '@/test/shareBoard';

import { buildEnvelope, type ShareRead } from './envelope';
import {
  decodeJsonPayload,
  jsonExtent,
  pastedLink,
  SHARE_JSON_LINK_PREFIX,
  shareLink,
  takeShareLink,
} from './link';
import { readLink } from './readLink';
import { toBase64Url } from './secrets';

const HOME = 'https://www.fooboard.dev';
const board = shareBoard();
const json = JSON.stringify(buildEnvelope([board], null));
const utf8 = (text: string): Uint8Array => new TextEncoder().encode(text);
const BASE64URL = toBase64Url(utf8(json));
const STANDARD = btoa(String.fromCharCode(...utf8(json)));
const at = (payload: string): string =>
  `${HOME}/${SHARE_JSON_LINK_PREFIX}${payload}`;

/** Opening `url`, as `main.tsx` does. */
const opened = (url: string): ShareRead | null => {
  const taken = takeShareLink(windowAt(url), '/');
  return taken && readLink(taken);
};
/** Pasting `text` into the import dialog's paste field. */
const pasted = (text: string): ShareRead => readLink(pastedLink(text));

const twin = opened(shareLink(buildEnvelope([board], null), HOME));
const DAMAGED = { ok: false, reason: 'damaged', issues: [] };

describe('#j= links', () => {
  it('a base64url link reads the same share as its #b= twin', () => {
    expect(twin).toMatchObject({ ok: true });
    expect(opened(at(BASE64URL))).toEqual(twin);
  });

  // Payloads are exact, never through `URL`, which would re-encode them.
  it.each([
    [
      'base64url with padding',
      `${BASE64URL}${'='.repeat((4 - (BASE64URL.length % 4)) % 4)}`,
    ],
    ['standard base64, padded', STANDARD],
    ['standard base64, unpadded', STANDARD.replace(/=+$/, '')],
    ['percent-encoded JSON', encodeURIComponent(json)],
    [
      'percent-encoded JSON with a lower-case %7b',
      encodeURIComponent(json).replace(/^%7B/, '%7b'),
    ],
    ['raw JSON', json],
    [
      'raw JSON with its quotes percent-encoded, as browsers do',
      json.replaceAll('"', '%22'),
    ],
  ])('%s reads the same share', (_form, payload) => {
    expect(readLink(decodeJsonPayload(payload))).toEqual(twin);
  });

  it('reads raw JSON holding a literal % as it is, not percent-decoded', () => {
    const named = { ...board, name: 'feat%x 100%' };
    const raw = JSON.stringify(buildEnvelope([named], null));
    const read = readLink(decodeJsonPayload(raw));
    expect(read).toMatchObject({ ok: true });
    expect(read.ok && read.share.dashboards[0]?.name).toBe('feat%x 100%');
  });

  it('reads percent-encoded JSON holding an encoded %', () => {
    const named = { ...board, name: 'feat%x' };
    const encoded = encodeURIComponent(
      JSON.stringify(buildEnvelope([named], null)),
    );
    const read = readLink(decodeJsonPayload(encoded));
    expect(read.ok && read.share.dashboards[0]?.name).toBe('feat%x');
  });

  it('keeps a raw payload that is neither JSON nor percent-decodable, refused as not JSON', () => {
    const read = readLink(decodeJsonPayload('{%E0%A4%A'));
    expect(read).toMatchObject({ ok: false, reason: 'damaged' });
    expect(!read.ok && read.issues.map((i) => i.path)).toEqual(['share']);
    expect(!read.ok && read.issues[0]?.message).toMatch(/^not JSON: /);
  });

  it.each([
    ['empty', ''],
    ['outside both alphabets', 'eyJh$'],
    ['of an impossible length', 'eyJhY'],
    [
      "of bytes that aren't UTF-8",
      toBase64Url(new Uint8Array([0x7b, 0xff, 0xfe, 0x7d])),
    ],
  ])('refuses a payload %s as damaged', (_why, payload) => {
    expect(readLink(decodeJsonPayload(payload))).toEqual(DAMAGED);
  });

  it('gives base64 that decodes but is no share its issues', () => {
    const read = readLink(decodeJsonPayload(toBase64Url(utf8('[1]'))));
    expect(read).toMatchObject({ ok: false, reason: 'notShare' });
  });

  it('clears the fragment before decoding', () => {
    const win = windowAt(at(BASE64URL));
    expect(takeShareLink(win, '/')).toEqual({ kind: 'text', text: json });
    expect(win.history.replaceState).toHaveBeenCalledOnce();
    expect(win.url.href).toBe(`${HOME}/`);
  });
});

describe('pasted #j= links', () => {
  it.each([
    ['base64url, then a full stop and words', `${at(BASE64URL)}. Open it!`],
    ['standard base64, then a line break', `${at(STANDARD)}\nthanks`],
    [
      'percent-encoded JSON, then a space',
      `${at(encodeURIComponent(json))} done`,
    ],
    ['raw JSON, then a full stop', `${at(json)}.`],
  ])('reads %s, ignoring what follows', (_form, text) => {
    expect(pasted(text)).toEqual(twin);
  });

  it('reads raw JSON spanning spaces and line breaks, with braces and escaped quotes inside strings, to its balancing brace', () => {
    const named = { ...board, name: 'a } { \\" "quoted" }' };
    const pretty = JSON.stringify(buildEnvelope([named], null), null, 2);
    const read = pasted(`Here: ${HOME}/#j=${pretty} and that's it }`);
    expect(read.ok && read.share.dashboards[0]?.name).toBe(
      'a } { \\" "quoted" }',
    );
  });

  it('reads raw JSON whose braces never balance to the end, refused as not JSON', () => {
    const read = pasted(`${HOME}/#j=${json.slice(0, -1)}`);
    expect(!read.ok && read.issues[0]?.message).toMatch(/^not JSON: /);
  });

  it('reads whichever prefix comes first', () => {
    const b = shareLink(buildEnvelope([{ ...board, name: 'b' }], null), HOME);
    const j = at(
      toBase64Url(
        utf8(JSON.stringify(buildEnvelope([{ ...board, name: 'j' }], null))),
      ),
    );
    const nameOf = (text: string): string | false =>
      ((r) => r.ok && (r.share.dashboards[0]?.name ?? ''))(pasted(text));
    expect(nameOf(`${j} ${b}`)).toBe('j');
    expect(nameOf(`${b} ${j}`)).toBe('b');
  });
});

describe('jsonExtent', () => {
  it.each([
    ['{}', 2],
    ['{"a":{"b":1}} tail', 13],
    ['{"a":"}"} tail', 9],
    ['{"a":"\\"}"} tail', 11],
    ['{"a":"\\\\"} tail', 10],
    ['{"a":1', 6],
  ])('ends %j at %i', (text, end) => {
    expect(jsonExtent(text)).toBe(end);
  });
});
