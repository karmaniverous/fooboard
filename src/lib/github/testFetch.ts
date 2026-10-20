/**
 * A fake `fetch` for reader tests: canned responses by URL, recording
 * the URLs asked for.
 *
 * @module
 */
import type { FetchLike } from './httpClient';

export function jsonResponse(
  body: unknown,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), { status: 200, headers });
}

export function fakeFetch(handlers: Record<string, () => Response>): {
  fetchImpl: FetchLike;
  calls: string[];
} {
  const calls: string[] = [];
  const fetchImpl: FetchLike = (url) => {
    calls.push(url);
    const handler = handlers[url] as (() => Response) | undefined;
    if (!handler) throw new Error(`unexpected URL: ${url}`);
    return Promise.resolve(handler());
  };
  return { fetchImpl, calls };
}
