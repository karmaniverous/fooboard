/**
 * The simulated GitHub API's errors, ETags and budget (spec.md §3.14
 * *Request surface*): `401` for a rejected, unknown or missing token,
 * `404` for what the token can't see or doesn't exist, `500` for a
 * faulted repo, each with GitHub's JSON error body; ETags on every
 * answer and a free `304` on a match; `x-ratelimit-*` counted down per
 * token and reset hourly, and `403` once a token has spent its budget.
 */
import { describe, expect, it } from 'vitest';

import { MINUTE } from '@/demo/scenarios/pipeline';
import { GITHUB_API_BASE } from '@/lib/transport';
import { rawBody, SIM_HTTP_EPOCH, simHttp } from '@/test/simHttp';
import {
  TINY_REJECTED,
  TINY_REPO,
  TINY_TOKEN,
  tinyScenario,
} from '@/test/simScenario';

import { createRateBook, GITHUB_RATE_LIMIT } from './github';
import { createSimulator } from './simulator';

describe('simulated GitHub errors and budget', () => {
  it("answers GitHub's errors: 401, 404, 500", async () => {
    const { github } = simHttp();
    const error = async (res: Response) => ({
      status: res.status,
      body: await rawBody(res),
    });
    const bad = {
      message: 'Bad credentials',
      documentation_url: 'https://docs.github.com/rest',
      status: '401',
    };
    expect(await error(await github('/user/repos', TINY_REJECTED))).toEqual({
      status: 401,
      body: bad,
    });
    expect(await error(await github('/user/repos', 'unknown'))).toEqual({
      status: 401,
      body: bad,
    });
    expect(await error(await github('/user/repos', null))).toEqual({
      status: 401,
      body: bad,
    });
    for (const path of [
      '/repos/acme/hidden/branches',
      '/repos/acme/nope/branches',
      `/repos/${TINY_REPO}/pulls`,
      '/repos/acme',
      '/rate_limit',
    ])
      expect((await github(path)).status).toBe(404);
    expect(
      await error(await github('/repos/acme/broken/branches')),
    ).toMatchObject({ status: 500, body: { message: 'Server Error' } });
  });

  it('tags answers with ETags; a match is a free 304', async () => {
    const { github } = simHttp();
    const first = await github(`/repos/${TINY_REPO}/branches`);
    const etag = first.headers.get('etag') ?? '';
    expect(etag).toMatch(/^W\/"/);
    expect(first.headers.get('x-ratelimit-remaining')).toBe(
      String(GITHUB_RATE_LIMIT - 1),
    );
    const again = await github(`/repos/${TINY_REPO}/branches`, TINY_TOKEN, {
      'if-none-match': etag,
    });
    expect(again.status).toBe(304);
    expect(await again.text()).toBe('');
    expect(again.headers.get('etag')).toBe(etag);
    expect(again.headers.get('x-ratelimit-remaining')).toBe(
      String(GITHUB_RATE_LIMIT - 1),
    );
    expect(
      (
        await github(`/repos/${TINY_REPO}/branches`, TINY_TOKEN, {
          'if-none-match': 'W/"x"',
        })
      ).status,
    ).toBe(200);
    // Errors carry no ETag.
    expect(
      (await github('/repos/acme/broken/branches')).headers.get('etag'),
    ).toBeNull();
  });

  it('counts the budget down per token and resets it hourly', async () => {
    const { github, at } = simHttp();
    const headers = (res: Response) =>
      ['limit', 'remaining', 'used', 'reset', 'resource'].map((h) =>
        res.headers.get(`x-ratelimit-${h}`),
      );
    const reset = String((SIM_HTTP_EPOCH + 60 * MINUTE) / 1000);
    expect(headers(await github('/user/repos'))).toEqual([
      '5000',
      '4999',
      '1',
      reset,
      'core',
    ]);
    expect(headers(await github('/repos/acme/nope/branches'))).toEqual([
      '5000',
      '4998',
      '2',
      reset,
      'core',
    ]);
    at(60 * MINUTE);
    expect(headers(await github('/user/repos')).slice(1, 3)).toEqual([
      '4999',
      '1',
    ]);
  });

  it('answers 403 once a token has spent its budget, until it resets', async () => {
    const transport = createSimulator(tinyScenario(), {
      clock: () => SIM_HTTP_EPOCH,
      rateLimit: 1,
    });
    const get = () =>
      transport.fetch(`${GITHUB_API_BASE}/user/repos`, {
        headers: { authorization: `Bearer ${TINY_TOKEN}` },
      });
    expect((await get()).status).toBe(200);
    const spent = await get();
    expect(spent.status).toBe(403);
    expect(await rawBody(spent)).toMatchObject({
      message: 'API rate limit exceeded',
    });
    expect(spent.headers.get('x-ratelimit-remaining')).toBe('0');
  });

  it('keeps a budget per token and stops counting at zero', () => {
    const rates = createRateBook(2);
    expect(rates.exhausted('t', 0)).toBe(false);
    rates.charge('t', 0, false);
    expect(rates.charge('t', 0, true)['x-ratelimit-remaining']).toBe('1');
    expect(rates.charge('t', 0, false)['x-ratelimit-remaining']).toBe('0');
    expect(rates.exhausted('t', 0)).toBe(true);
    expect(rates.charge('t', 0, false)['x-ratelimit-used']).toBe('2');
    expect(rates.exhausted('other', 0)).toBe(false);
  });
});
