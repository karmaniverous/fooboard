/**
 * Tests for `chosenBranches` (the branch rule) and `listAppsAcrossRegions`
 * with fake readers: which region errors are skipped.
 *
 * @module
 */
import { describe, expect, it, vi } from 'vitest';

import {
  amplifyApp,
  amplifyBranch,
  amplifyJobSummary,
} from '@/lib/amplify/sdkShapes';

import { AmplifyAuthError, AmplifyNotFoundError } from './errors';
import type { AmplifyReader } from './reader';
import { chosenBranches, listAppsAcrossRegions } from './rowJobs';

function reader({
  branches = [] as string[],
  apps = [] as string[],
  appsError,
}: { branches?: string[]; apps?: string[]; appsError?: Error } = {}) {
  return {
    listApps: vi.fn(() =>
      appsError
        ? Promise.reject(appsError)
        : Promise.resolve(apps.map((appId) => amplifyApp({ appId }))),
    ),
    listBranches: vi.fn(() =>
      Promise.resolve(
        branches.map((branchName) => amplifyBranch({ branchName })),
      ),
    ),
    listJobs: vi.fn((_app: string, branch: string) =>
      Promise.resolve([amplifyJobSummary({ jobId: `${branch}-1` })]),
    ),
    getJob: vi.fn(),
  } satisfies AmplifyReader;
}

const glob = (value: string) => ({
  path: '$.branchName',
  operator: 'glob' as const,
  value,
  ignoreCase: true,
  quantifier: 'any' as const,
  not: false,
});

describe('chosenBranches', () => {
  it('keeps the branches the branch rule matches, by name', () => {
    const branches = ['main', 'preview/bali', 'feature/x'].map((branchName) =>
      amplifyBranch({ branchName }),
    );
    expect(
      chosenBranches(branches, {
        branches: { combine: 'or', checks: [glob('main'), glob('preview/*')] },
      }),
    ).toEqual(['main', 'preview/bali']);
  });
});

describe('listAppsAcrossRegions', () => {
  it('skips regions where Amplify is unavailable and tags the rest', async () => {
    const readers: Record<string, ReturnType<typeof reader>> = {
      'us-east-1': reader({ apps: ['a1', 'a2'] }),
      'ap-east-1': reader({
        appsError: new AmplifyNotFoundError('not here', 'ListApps'),
      }),
      'eu-west-1': reader({ apps: ['b1'] }),
    };
    const found = await listAppsAcrossRegions(
      'aws1',
      Object.keys(readers),
      ({ region }) => readers[region] ?? reader(),
    );
    expect(found.map((f) => `${f.region}:${f.app.appId ?? ''}`)).toEqual([
      'us-east-1:a1',
      'us-east-1:a2',
      'eu-west-1:b1',
    ]);
  });

  it('propagates credential errors', async () => {
    await expect(
      listAppsAcrossRegions('aws1', ['us-east-1'], () =>
        reader({ appsError: new AmplifyAuthError('denied', 'ListApps') }),
      ),
    ).rejects.toBeInstanceOf(AmplifyAuthError);
  });
});
