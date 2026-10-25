/**
 * The simulated Amplify API (spec.md §3.14 *Request surface*), through the
 * AWS SDK as the readers use it and as raw requests: `ListApps` per
 * account and region, `ListBranches`, `ListJobs` newest first, pages by
 * `maxResults` and `nextToken`, and AWS's errors (status, error type
 * header, JSON message).
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { MINUTE } from '@/demo/scenarios/pipeline';
import { createAmplifyReader } from '@/lib/amplify/reader';
import { bodyOf, rawBody } from '@/test/simHttp';
import {
  TINY_ACCOUNT,
  TINY_KEY_ID,
  TINY_REPO,
  tinyScenario,
} from '@/test/simScenario';

import type { DemoScenario } from './scenario';
import { createSimulator } from './simulator';

const EPOCH = Date.UTC(2026, 9, 25, 12);

function sim(s: DemoScenario = tinyScenario()) {
  const transport = createSimulator(s, { clock: () => EPOCH });
  const reader = (region = 'us-east-1', accessKeyId = TINY_KEY_ID) =>
    createAmplifyReader({
      region,
      accessKeyId,
      secretAccessKey: 'tiny-secret',
      fetch: transport.fetch,
    });
  const raw = (path: string, keyId = TINY_KEY_ID, region = 'us-east-1') =>
    transport.fetch(`https://amplify.${region}.amazonaws.com${path}`, {
      headers: {
        authorization: `AWS4-HMAC-SHA256 Credential=${keyId}/20261025/${region}/amplify/aws4_request, SignedHeaders=host, Signature=x`,
      },
    });
  return { reader, raw };
}

const withApps = (count: number) => {
  const base = tinyScenario();
  const apps = Array.from({ length: count }, (_, i) => ({
    account: TINY_ACCOUNT,
    region: 'eu-west-1',
    appId: `eu${String(i)}`,
    name: `eu-app-${String(i)}`,
    branches: [],
  }));
  return tinyScenario({
    aws: { ...base.aws, apps: [...base.aws.apps, ...apps] },
  });
};

describe('simulated Amplify', () => {
  it("lists an account's apps in their region only, empty elsewhere", async () => {
    const { reader } = sim();
    const [app] = await reader().listApps();
    expect(app).toMatchObject({
      appId: 'app1',
      name: 'app',
      repository: `https://github.com/${TINY_REPO}`,
      appArn: `arn:aws:amplify:us-east-1:${TINY_ACCOUNT}:apps/app1`,
      defaultDomain: 'app1.amplifyapp.com',
    });
    expect(app.createTime).toEqual(new Date(EPOCH - 60 * MINUTE));
    expect(await reader('eu-west-1').listApps()).toEqual([]);
  });

  it('lists branches and newest-first jobs with their states', async () => {
    const s = tinyScenario({
      pinned: [
        {
          kind: 'commit',
          repo: TINY_REPO,
          branch: 'main',
          at: -10 * MINUTE,
          message: 'First',
        },
        {
          kind: 'commit',
          repo: TINY_REPO,
          branch: 'main',
          at: -MINUTE / 2,
          message: 'Second',
        },
      ],
    });
    const { reader } = sim(s);
    const branches = await reader().listBranches('app1');
    expect(branches.map((b) => [b.branchName, b.totalNumberOfJobs])).toEqual([
      ['main', '2'],
    ]);
    const jobs = await reader().listJobs('app1', 'main', 50);
    expect(jobs.map((j) => [j.jobId, j.status, j.commitMessage])).toEqual([
      ['2', 'RUNNING', 'Second'],
      ['1', 'SUCCEED', 'First'],
    ]);
    expect(jobs[0]?.endTime).toBeUndefined();
    expect(jobs[1]?.endTime).toEqual(new Date(EPOCH - 9 * MINUTE));
    expect(jobs[1]?.startTime).toEqual(new Date(EPOCH - 10 * MINUTE));
  });

  it('follows every page through the SDK', async () => {
    const { reader } = sim(withApps(3));
    expect((await reader('eu-west-1').listApps()).map((a) => a.appId)).toEqual([
      'eu0',
      'eu1',
      'eu2',
    ]);
  });

  it('pages in the region asked', async () => {
    const { raw } = sim(withApps(3));
    const Page = z.object({
      apps: z.array(z.object({ appId: z.string() })),
      nextToken: z.string().optional(),
    });
    const first = await bodyOf(
      await raw('/apps?maxResults=2', TINY_KEY_ID, 'eu-west-1'),
      Page,
    );
    expect(first.apps.map((a) => a.appId)).toEqual(['eu0', 'eu1']);
    const token = encodeURIComponent(first.nextToken ?? '');
    const next = await bodyOf(
      await raw(
        `/apps?maxResults=2&nextToken=${token}`,
        TINY_KEY_ID,
        'eu-west-1',
      ),
      Page,
    );
    expect(next).toEqual({ apps: [{ appId: 'eu2' }] });
  });

  it("answers AWS's errors with status, error type and message", async () => {
    const { raw, reader } = sim();
    const error = async (res: Response) => ({
      status: res.status,
      type: res.headers.get('x-amzn-errortype')?.split(':')[0],
      body: await rawBody(res),
    });
    expect(await error(await raw('/apps', 'UNKNOWNKEY'))).toEqual({
      status: 403,
      type: 'UnrecognizedClientException',
      body: {
        message: 'The security token included in the request is invalid.',
      },
    });
    expect(await error(await raw('/apps/nope/branches'))).toMatchObject({
      status: 404,
      type: 'NotFoundException',
      body: { message: 'App nope not found.' },
    });
    expect(
      await error(await raw('/apps/app1/branches/gone/jobs')),
    ).toMatchObject({ status: 404, type: 'NotFoundException' });
    expect(await error(await raw('/apps/app1/webhooks'))).toMatchObject({
      status: 404,
      type: 'NotFoundException',
    });
    expect(
      await error(await raw('/apps/app1/branches/main/jobs/1/x')),
    ).toMatchObject({ status: 404 });
    expect(
      await error(await raw('/apps/app1/branches/main/artifacts')),
    ).toMatchObject({ status: 404 });
    expect(await error(await raw('/domains'))).toMatchObject({ status: 404 });
    expect(await error(await raw('/apps?maxResults=101'))).toMatchObject({
      status: 400,
      type: 'BadRequestException',
    });
    expect(await error(await raw('/apps?maxResults=0'))).toMatchObject({
      status: 400,
    });
    expect(await error(await raw('/apps?nextToken=bm9wZQ'))).toMatchObject({
      status: 400,
    });
    expect(await error(await raw('/apps?nextToken=%%%'))).toMatchObject({
      status: 400,
    });
    expect(
      await error(await raw('/apps/app1/branches?maxResults=51')),
    ).toMatchObject({ status: 400 });
    // Through the SDK, a key AWS doesn't know is an auth failure.
    await expect(
      reader('us-east-1', 'UNKNOWNKEY').listApps(),
    ).rejects.toMatchObject({ name: 'AmplifyAuthError' });
    await expect(reader().listBranches('nope')).rejects.toThrow();
  });
});
