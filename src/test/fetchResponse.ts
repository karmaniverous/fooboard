/**
 * Test helper: a Fetch `Response` with a JSON (or text) body, for the
 * fake `fetch` the GitHub adapter tests inject. No real network.
 *
 * @module
 */

/** Statuses the Fetch `Response` constructor forbids a body on. */
const NULL_BODY_STATUSES = new Set([204, 205, 304]);

/** A response with `status`, `body` (JSON unless a string) and headers. */
export function response(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response {
  const hasBody = body !== undefined && !NULL_BODY_STATUSES.has(status);
  return new Response(
    hasBody ? (typeof body === 'string' ? body : JSON.stringify(body)) : null,
    { status, headers },
  );
}
