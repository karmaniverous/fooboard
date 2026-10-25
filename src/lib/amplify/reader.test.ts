/**
 * Tests for the SDK-backed `AmplifyReader` with a fake `send`: paging with
 * `nextToken` and the `maxResults` cap, error mapping, and the delay a
 * throttle suggests.
 *
 * @module
 */
import { describe, expect, it, vi } from 'vitest';

import {
  AmplifyAuthError,
  AmplifyNotFoundError,
  AmplifyThrottledError,
  DEFAULT_THROTTLE_MS,
} from './errors';
import { type AmplifySender, createAmplifyReader } from './reader';

/** A fake client answering by command class name, in call order. */
function fakeClient(byCommand: Record<string, unknown[]>): {
  client: AmplifySender;
  inputs: { command: string; input: Record<string, unknown> }[];
} {
  const inputs: { command: string; input: Record<string, unknown> }[] = [];
  const send = vi.fn((command: { input: Record<string, unknown> }) => {
    const name = command.constructor.name;
    inputs.push({ command: name, input: command.input });
    const next = (byCommand[name] as unknown[] | undefined)?.shift();
    return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
  });
  return { client: { send }, inputs };
}

const awsError = (name: string): Error =>
  Object.assign(new Error('boom'), { name });

const config = { region: 'us-east-1', accessKeyId: 'k', secretAccessKey: 's' };

describe('createAmplifyReader', () => {
  it('follows nextToken across pages', async () => {
    const { client, inputs } = fakeClient({
      ListAppsCommand: [
        { apps: [{ appId: 'a' }], nextToken: 't2' },
        { apps: [{ appId: 'b' }] },
      ],
    });
    const apps = await createAmplifyReader({ ...config, client }).listApps();
    expect(apps.map((a) => a.appId)).toEqual(['a', 'b']);
    expect(inputs[1]?.input.nextToken).toBe('t2');
  });

  it('stops paging jobs once maxResults are collected', async () => {
    const { client, inputs } = fakeClient({
      ListJobsCommand: [
        { jobSummaries: [{ jobId: '1' }, { jobId: '2' }], nextToken: 'more' },
      ],
    });
    const jobs = await createAmplifyReader({ ...config, client }).listJobs(
      'a',
      'main',
      2,
    );
    expect(jobs).toHaveLength(2);
    expect(inputs).toHaveLength(1);
    expect(inputs[0]?.input.maxResults).toBe(2);
  });

  it('never asks for more than 50 items per page', async () => {
    const { client, inputs } = fakeClient({
      ListBranchesCommand: [{ branches: [] }],
      ListJobsCommand: [{ jobSummaries: [] }],
    });
    const reader = createAmplifyReader({ ...config, client });
    await reader.listBranches('a');
    await reader.listJobs('a', 'main', 500);
    expect(inputs.map((i) => i.input.maxResults)).toEqual([50, 50]);
  });

  it.each([
    ['NotFoundException', AmplifyNotFoundError],
    ['UnrecognizedClientException', AmplifyAuthError],
    ['ExpiredTokenException', AmplifyAuthError],
    ['TooManyRequestsException', AmplifyThrottledError],
  ])('maps %s to a typed error', async (name, type) => {
    const { client } = fakeClient({ ListBranchesCommand: [awsError(name)] });
    await expect(
      createAmplifyReader({ ...config, client }).listBranches('a'),
    ).rejects.toBeInstanceOf(type);
  });

  it('passes unknown errors through unchanged', async () => {
    const err = awsError('InternalFailureException');
    const { client } = fakeClient({ ListBranchesCommand: [err] });
    await expect(
      createAmplifyReader({ ...config, client }).listBranches('a'),
    ).rejects.toBe(err);
  });

  it("maps throttling to AWS's suggested delay, else 5 s", async () => {
    const hinted = Object.assign(awsError('ThrottlingException'), {
      $response: { headers: { 'retry-after': '12' } },
    });
    const { client } = fakeClient({
      ListBranchesCommand: [awsError('ThrottlingException'), hinted],
    });
    const reader = createAmplifyReader({ ...config, client });
    await expect(reader.listBranches('a')).rejects.toMatchObject({
      retryAfterMs: DEFAULT_THROTTLE_MS,
    });
    await expect(reader.listBranches('a')).rejects.toMatchObject({
      retryAfterMs: 12_000,
    });
  });
});
