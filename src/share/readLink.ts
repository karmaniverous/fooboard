/**
 * A share link's payload read as a share (spec.md §3.8): its JSON text
 * read by `readShare`, or *damaged* when it held nothing readable.
 *
 * @module
 */
import { readShare, refused, type ShareRead } from './envelope';
import type { LinkPayload } from './link';

/** A link's payload, read as a share. */
export const readLink = (link: LinkPayload): ShareRead =>
  link.kind === 'text' ? readShare(link.text) : refused('damaged');
