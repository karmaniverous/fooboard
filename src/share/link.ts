/**
 * Share links (spec.md A§3.8; spec 0.2.0 §3.J *`#j=` links*): the
 * envelope as JSON in the URL fragment, which browsers never send to a
 * server, nor in a `Referer` header. fooboard makes `#b=` links, the JSON
 * compressed with lz-string; it also reads `#j=` links, the JSON itself,
 * which an assistant can build without code: base64 (base64url or
 * standard, padded or not, of UTF-8) or the JSON text, possibly
 * percent-encoded. Opening one clears the fragment before anything else,
 * with `history.replaceState`, so the link stays out of history and a
 * reload can't import it twice; only then is the payload decoded, into
 * memory. A link pasted into the import dialog is read the same way
 * (`pastedLink`).
 *
 * @module
 */
// lz-string is CommonJS without named exports Node can see.
import LZString from 'lz-string';

import type { ShareEnvelope } from './envelope';
import { fromBase64Url } from './secrets';

/** The fragment that marks a share link fooboard makes (lz-string). */
export const SHARE_LINK_PREFIX = '#b=';
/** The fragment that marks a share link holding the share's JSON, as an
 * assistant builds one (spec 0.2.0 §3.J). */
export const SHARE_JSON_LINK_PREFIX = '#j=';
/** The longest share link offered; longer ones fall back to a file, since
 * they are pasted into chats with limits (a Slack message's 40,000). */
export const SHARE_LINK_MAX_CHARS = 32_000;
/** The longest URL X will link (twitter-text's `maxUrlLength`). */
export const X_LINK_MAX_CHARS = 4_096;

/** The share link for `envelope`, at the app's home under `origin`. */
export function shareLink(
  envelope: ShareEnvelope,
  origin: string = window.location.origin,
): string {
  const home = new URL(import.meta.env.BASE_URL, origin).toString();
  return `${home}${SHARE_LINK_PREFIX}${LZString.compressToEncodedURIComponent(
    JSON.stringify(envelope),
  )}`;
}

/** What an opened link held: its JSON text, or nothing readable. */
export type LinkPayload = { kind: 'text'; text: string } | { kind: 'damaged' };

const DAMAGED: LinkPayload = { kind: 'damaged' };

/** The parts of the window a link is opened from. */
export interface LinkWindow {
  location: Pick<Location, 'hash'>;
  history: Pick<History, 'replaceState' | 'state'>;
}

/** Decompress a `#b=` link's payload. */
function decodePayload(payload: string): LinkPayload {
  let text: string | null;
  try {
    text = LZString.decompressFromEncodedURIComponent(payload);
  } catch {
    text = null;
  }
  return text ? { kind: 'text', text } : DAMAGED;
}

/** The start of a JSON object. */
const OPEN = '{';
const CLOSE = '}';
/** `{` percent-encoded, in either case. */
const ENCODED_OPEN = /^%7b/i;
/** Text that is only base64 characters, in either alphabet, with
 * padding. */
const BASE64 = /^[A-Za-z0-9+/=_-]+$/;
/** The base64 run at the start of pasted text. */
const BASE64_RUN = /^[A-Za-z0-9+/=_-]*/;
/** Anything up to the first whitespace. */
const TO_WHITESPACE = /^\S*/;

/** UTF-8 that refuses a malformed byte sequence rather than replacing
 * it. */
const UTF8 = new TextDecoder('utf-8', { fatal: true });

const parses = (text: string): boolean => {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
};

/** `text` percent-decoded, or as it is if that throws. */
const percentDecoded = (text: string): string => {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
};

/**
 * Decode a `#j=` link's payload (spec 0.2.0 §3.J). The JSON form starts
 * with `{` or `%7B`: raw JSON that parses is read as it is, since it may
 * hold a literal `%` that percent-decoding would throw on or corrupt;
 * anything else is percent-decoded, kept raw if that throws. Otherwise
 * the payload is base64 of UTF-8; one that isn't is *damaged*. Decoded
 * text that isn't a share is `readShare`'s to refuse.
 */
export function decodeJsonPayload(payload: string): LinkPayload {
  if (payload.startsWith(OPEN) && parses(payload))
    return { kind: 'text', text: payload };
  if (payload.startsWith(OPEN) || ENCODED_OPEN.test(payload))
    return { kind: 'text', text: percentDecoded(payload) };
  if (!BASE64.test(payload)) return DAMAGED;
  try {
    return { kind: 'text', text: UTF8.decode(fromBase64Url(payload)) };
  } catch {
    return DAMAGED;
  }
}

/**
 * Where raw JSON at the start of `text` ends: just after the `}` that
 * balances its first `{`, counting braces outside strings (honouring
 * `\"` and `\\` inside them), or the end of `text` if none does.
 */
export function jsonExtent(text: string): number {
  let depth = 0;
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (c === '\\') i++;
      else if (c === '"') inString = false;
    } else if (c === '"') inString = true;
    else if (c === OPEN) depth++;
    else if (c === CLOSE && --depth === 0) return i + 1;
  }
  return text.length;
}

/** `text` cut just after the `}` that balances its first `{`. */
const toBalancingBrace = (text: string): string =>
  text.slice(0, jsonExtent(text));

/** A pasted `#j=` payload decoded, cut where the link ends, so text after
 * it (a full stop, Slack's `>`, a line break, more words) is never read:
 * raw JSON at its balancing brace; percent-encoded JSON percent-decoded
 * up to the first whitespace and then cut the same way (spec 0.2.0 §3.J
 * *Pasted percent-encoded links*); base64 at the end of its run. */
function pastedJsonPayload(rest: string): LinkPayload {
  if (ENCODED_OPEN.test(rest)) {
    const decoded = percentDecoded(TO_WHITESPACE.exec(rest)?.[0] ?? '');
    return {
      kind: 'text',
      text: decoded.startsWith(OPEN) ? toBalancingBrace(decoded) : decoded,
    };
  }
  if (rest.startsWith(OPEN)) return decodeJsonPayload(toBalancingBrace(rest));
  return decodeJsonPayload(BASE64_RUN.exec(rest)?.[0] ?? '');
}

/** Each kind of share link: its fragment prefix and how its payload is
 * decoded. */
const LINK_FORMS: readonly {
  prefix: string;
  decode: (payload: string) => LinkPayload;
}[] = [
  { prefix: SHARE_LINK_PREFIX, decode: decodePayload },
  { prefix: SHARE_JSON_LINK_PREFIX, decode: decodeJsonPayload },
];

/**
 * What a link pasted into the import dialog holds: the payload after the
 * first `#b=` or `#j=` in the text, decoded as opening the link decodes
 * it, or nothing readable when the text has neither (Decision 69). No
 * trim: lz-string stops at the stream's end marker and a `#j=` payload is
 * cut where it ends (`pastedJsonPayload`), so whatever follows is never
 * read, as `linkParity.test.ts` pins.
 */
export function pastedLink(text: string): LinkPayload {
  const b = text.indexOf(SHARE_LINK_PREFIX);
  const j = text.indexOf(SHARE_JSON_LINK_PREFIX);
  if (b < 0 && j < 0) return DAMAGED;
  return j < 0 || (b >= 0 && b < j)
    ? decodePayload(text.slice(b + SHARE_LINK_PREFIX.length))
    : pastedJsonPayload(text.slice(j + SHARE_JSON_LINK_PREFIX.length));
}

/**
 * If the window's URL is a share link (`#b=` or `#j=`), clear the
 * fragment at once (the URL becomes the app's home, `home`), then decode
 * the payload, the rest of the fragment; else `null`, and nothing is
 * touched.
 */
export function takeShareLink(
  win: LinkWindow,
  home: string = import.meta.env.BASE_URL,
): LinkPayload | null {
  const { hash } = win.location;
  const link = LINK_FORMS.find(({ prefix }) => hash.startsWith(prefix));
  if (!link) return null;
  win.history.replaceState(win.history.state, '', home);
  return link.decode(hash.slice(link.prefix.length));
}
