/**
 * The simulator's HTTP pieces (spec.md §3.14 *Request surface*): weak
 * ETags from a body's bytes, `304` with no body on a match, responses
 * with a JSON content type only when they have a body, page parameters,
 * and GitHub's `Link` header.
 */
import { describe, expect, it } from 'vitest';

import {
  etagOf,
  json,
  linkHeader,
  pageOf,
  positiveParam,
  STATUS,
  toResponse,
  withEtag,
} from './http';

describe('simulator HTTP', () => {
  it('tags a body with a weak ETag of its bytes', () => {
    expect(etagOf('{"a":1}')).toMatch(/^W\/"[0-9a-f]{16}"$/);
    expect(etagOf('{"a":1}')).toBe(etagOf('{"a":1}'));
    expect(etagOf('{"a":2}')).not.toBe(etagOf('{"a":1}'));
  });

  it('answers 304 with no body when If-None-Match matches, keeping headers', () => {
    const answer = json(STATUS.ok, { a: 1 }, { link: 'x' });
    const tagged = withEtag(answer, null);
    const etag = etagOf(JSON.stringify({ a: 1 }));
    expect(tagged).toEqual({
      status: 200,
      body: { a: 1 },
      headers: { link: 'x', etag },
    });
    expect(withEtag({ ...answer, delayMs: 5 }, etag)).toEqual({
      status: 304,
      headers: { link: 'x', etag },
      delayMs: 5,
    });
    expect(withEtag(answer, 'W/"other"').status).toBe(200);
  });

  it('builds a Response, JSON only when there is a body', async () => {
    const ok = toResponse(json(200, { a: 1 }, { etag: 'e' }));
    expect(ok.status).toBe(200);
    expect(ok.headers.get('content-type')).toBe(
      'application/json; charset=utf-8',
    );
    expect(ok.headers.get('etag')).toBe('e');
    expect(await ok.json()).toEqual({ a: 1 });
    const notModified = toResponse({
      status: 304,
      body: { a: 1 },
      headers: { etag: 'e' },
    });
    expect(notModified.headers.get('content-type')).toBeNull();
    expect(await notModified.text()).toBe('');
    expect(toResponse({ status: 204 }).headers.get('content-type')).toBeNull();
  });

  it('reads whole positive page parameters, else the fallback', () => {
    const url = new URL('https://x.test/?per_page=5&page=0&bad=2.5&neg=-1');
    expect(positiveParam(url, 'per_page', 30)).toBe(5);
    expect(positiveParam(url, 'page', 1)).toBe(1);
    expect(positiveParam(url, 'bad', 1)).toBe(1);
    expect(positiveParam(url, 'neg', 1)).toBe(1);
    expect(positiveParam(url, 'missing', 7)).toBe(7);
    expect(pageOf([1, 2, 3, 4, 5], 2, 2)).toEqual([3, 4]);
    expect(pageOf([1, 2, 3], 3, 2)).toEqual([]);
  });

  it("writes GitHub's Link header, keeping the other parameters", () => {
    const url = new URL(
      'https://api.github.com/repos/a/b/actions/runs?per_page=2&page=2&exclude_pull_requests=true',
    );
    expect(linkHeader(url, 1, 1)).toBeUndefined();
    const at = (n: number) =>
      `https://api.github.com/repos/a/b/actions/runs?per_page=2&page=${String(n)}&exclude_pull_requests=true`;
    expect(linkHeader(url, 2, 3)).toBe(
      `<${at(1)}>; rel="prev", <${at(3)}>; rel="next", <${at(3)}>; rel="last", <${at(1)}>; rel="first"`,
    );
    expect(linkHeader(url, 1, 2)).toBe(
      `<${at(2)}>; rel="next", <${at(2)}>; rel="last"`,
    );
    expect(linkHeader(url, 2, 2)).toBe(
      `<${at(1)}>; rel="prev", <${at(1)}>; rel="first"`,
    );
  });
});
