/**
 * Tests for the SDK-backed `AmplifyReader` with a fake `send`: paging with
 * `nextToken` and the `maxResults` cap, error mapping, and the queue pause
 * after throttling.
 *
 * @module
 */
import { describe, expect, it, vi } from 'vitest';

import { SerialQueue } from '@/lib/queue/serialQueue';

import {
  AmplifyAuthError,
  AmplifyNotFoundError,
  AmplifyThrottledError,
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

  it('pauses the credential queue after throttling', async () => {
    const queue = new SerialQueue();
    const { client } = fakeClient({
      GetJobCommand: [awsError('ThrottlingException')],
    });
    const before = Date.now();
    await expect(
      createAmplifyReader({ ...config, client, queue }).getJob(
        'a',
        'main',
        '1',
      ),
    ).rejects.toBeInstanceOf(AmplifyThrottledError);
    expect(queue.getPausedUntil()).toBeGreaterThanOrEqual(before + 5_000);
  });
});
