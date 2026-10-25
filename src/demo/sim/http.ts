/**
 * HTTP pieces the simulator answers with (spec.md §3.14 *Request
 * surface*): an answer (status, JSON body, headers, an extra delay)
 * turned into a `Response`; weak ETags from the body's bytes, so the same
 * world gives the same ETag and a matching `If-None-Match` gets `304`;
 * page parameters and GitHub's `Link` header. Pure.
 *
 * @module
 */
import { hash32 } from './random';

/** HTTP statuses the simulator sends. */
export const STATUS = {
  ok: 200,
  notModified: 304,
  badRequest: 400,
  unauthorized: 401,
  forbidden: 403,
  notFound: 404,
  serverError: 500,
} as const;

/** What a route answers. */
export interface SimAnswer {
  status: number;
  body?: unknown;
  headers?: Record<string, string>;
  /** Answer this much later than the transport's latency alone. */
  delayMs?: number;
}

/** Hex digits of each half of an ETag. */
const HALF_DIGITS = 8;
const hex = (n: number): string => n.toString(16).padStart(HALF_DIGITS, '0');

/** The weak ETag of a body's text, as GitHub sends them: two fast hashes
 * (an ETag only has to change with its body, not resist forgery; a
 * cryptographic digest of every body costs the demo's main thread). */
export const etagOf = (text: string): string =>
  `W/"${hex(hash32(text))}${hex(hash32(`${String(text.length)}:${text}`))}"`;

/** A JSON answer with `status`. */
export const json = (
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): SimAnswer => ({
  status,
  body,
  headers,
});

/** `answer`, conditional on `ifNoneMatch`: a matching ETag gets `304`
 * with no body (keeping the other headers). */
export function withEtag(
  answer: SimAnswer,
  ifNoneMatch: string | null,
): SimAnswer {
  const etag = etagOf(JSON.stringify(answer.body));
  const headers = { ...answer.headers, etag };
  return ifNoneMatch === etag
    ? { status: STATUS.notModified, headers, delayMs: answer.delayMs }
    : { ...answer, headers };
}

/** The `Response` for `answer`. */
export function toResponse(answer: SimAnswer): Response {
  const hasBody =
    answer.body !== undefined && answer.status !== STATUS.notModified;
  return new Response(hasBody ? JSON.stringify(answer.body) : null, {
    status: answer.status,
    headers: {
      ...(hasBody ? { 'content-type': 'application/json; charset=utf-8' } : {}),
      ...answer.headers,
    },
  });
}

/** A query parameter as a whole number ≥ 1, else `fallback`. */
export function positiveParam(
  url: URL,
  name: string,
  fallback: number,
): number {
  const value = Number(url.searchParams.get(name));
  return Number.isInteger(value) && value >= 1 ? value : fallback;
}

/** One page of `items`: 1-based `page` of `perPage`. */
export const pageOf = <T>(
  items: readonly T[],
  page: number,
  perPage: number,
): T[] => items.slice((page - 1) * perPage, page * perPage);

/** GitHub's `Link` header for `page` of `pages` at `url` (its other
 * parameters kept); `undefined` for a single page. */
export function linkHeader(
  url: URL,
  page: number,
  pages: number,
): string | undefined {
  if (pages <= 1) return undefined;
  const at = (n: number, rel: string) => {
    const u = new URL(url);
    u.searchParams.set('page', String(n));
    return `<${u.toString()}>; rel="${rel}"`;
  };
  return [
    ...(page > 1 ? [at(page - 1, 'prev')] : []),
    ...(page < pages ? [at(page + 1, 'next'), at(pages, 'last')] : []),
    ...(page > 1 ? [at(1, 'first')] : []),
  ].join(', ');
}
