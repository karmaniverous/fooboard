/**
 * Share links (spec.md C-19): the demo's absolute URL, and X's compose
 * page pre-filled with the tagline and a link (a plain link, no X script).
 *
 * @module
 */
import { site } from './site';

/** The absolute demo URL under the app's base path. */
export function demoUrl(origin: string = window.location.origin): string {
  return new URL(`${import.meta.env.BASE_URL}demo`, origin).toString();
}

/** X's compose page, pre-filled with the tagline and a link. */
export function postUrl(link: string): string {
  const params = new URLSearchParams({ text: site.tagline, url: link });
  return `https://x.com/intent/post?${params.toString()}`;
}
