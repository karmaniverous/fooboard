/**
 * Pull-request runs (spec.md A§4.3.7): dropped in the browser when the
 * GitHub source rule's reader says so, because the runs API can filter to
 * one event but can't exclude one. Pure.
 *
 * @module
 */
const EXCLUDED_EVENTS = new Set(['pull_request', 'pull_request_target']);

export function isExcludedEvent(event: string): boolean {
  return EXCLUDED_EVENTS.has(event);
}
