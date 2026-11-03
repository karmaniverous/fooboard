/**
 * Keeps the document's head in step with the route (spec 0.2.0 §3.K): the
 * static pages give `/demo` and every other path their own title,
 * descriptions and canonical address, but a move inside the app (a link,
 * Back or Forward) loads no page, so the app sets the same values itself
 * from the one source, `pageHead.ts`.
 *
 * @module
 */
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

import { HEAD_META, headFor, type PageHead } from './pageHead';

/** Writes `head` into `doc`: its title, and each tag of the head that
 * carries one of its values (a tag the page lacks is left out). */
export function applyHead(doc: Document, head: PageHead): void {
  doc.title = head.title;
  doc.querySelector('link[rel="canonical"]')?.setAttribute('href', head.url);
  for (const { attribute, key, field } of HEAD_META)
    doc
      .querySelector(`meta[${attribute}="${key}"]`)
      ?.setAttribute('content', head[field]);
}

/** Sets the document's head for the current route on every move. */
export function useDocumentHead(): void {
  const { pathname } = useLocation();
  useEffect(() => {
    applyHead(document, headFor(pathname));
  }, [pathname]);
}
