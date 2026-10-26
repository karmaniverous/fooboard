/**
 * Share links (spec.md §3.8): the envelope as JSON, compressed with
 * lz-string into the URL fragment (`#b=…`), which browsers never send to
 * a server, nor in a `Referer` header. Opening one clears the fragment
 * before anything else, with `history.replaceState`, so the link stays out
 * of history and a reload can't import it twice; only then is the payload
 * decompressed, into memory.
 *
 * @module
 */
// lz-string is CommonJS without named exports Node can see.
import LZString from 'lz-string';

import type { ShareEnvelope } from './envelope';

/** The fragment that marks a share link. */
export const SHARE_LINK_PREFIX = '#b=';
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

/** The parts of the window a link is opened from. */
export interface LinkWindow {
  location: Pick<Location, 'hash'>;
  history: Pick<History, 'replaceState' | 'state'>;
}

/**
 * If the window's URL is a share link, clear the fragment at once (the URL
 * becomes the app's home, `home`), then decompress the payload; else
 * `null`, and nothing is touched.
 */
export function takeShareLink(
  win: LinkWindow,
  home: string = import.meta.env.BASE_URL,
): LinkPayload | null {
  const { hash } = win.location;
  if (!hash.startsWith(SHARE_LINK_PREFIX)) return null;
  win.history.replaceState(win.history.state, '', home);
  let text: string | null;
  try {
    text = LZString.decompressFromEncodedURIComponent(
      hash.slice(SHARE_LINK_PREFIX.length),
    );
  } catch {
    text = null;
  }
  return text ? { kind: 'text', text } : { kind: 'damaged' };
}
