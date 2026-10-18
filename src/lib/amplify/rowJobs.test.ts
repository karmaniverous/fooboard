/**
 * Tests for `collectRowJobs` and `listAppsAcrossRegions` with fake readers:
 * branch-pattern filtering, source tagging across apps, `branchExists`, and
 * which region errors are skipped.
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
import { collectRowJobs, listAppsAcrossRegions } from './rowJobs';

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

const source = (appId: string, region = 'us-east-1') => ({
  credentialId: 'aws1',
  region,
  appId,
});

describe('collectRowJobs', () => {
  it('reads only branches matching the stage pattern, tagged by source', async () => {
    const byApp: Record<string, ReturnType<typeof reader>> = {
      web: reader({ branches: ['main', 'preview/bali', 'preview/lima'] }),
      api: reader({ branches: ['preview/oslo'] }),
    };
    const readerFor = vi.fn(() => byApp.web);
    readerFor.mockReturnValueOnce(byApp.web).mockReturnValueOnce(byApp.api);

    const result = await collectRowJobs(
      [source('web'), source('api', 'eu-west-1')],
      'preview/*',
      readerFor,
    );

    expect(result.branchExists).toBe(true);
    expect(
      result.jobsByBranch.map((j) => `${j.source.appId}:${j.branch}`),
    ).toEqual(['web:preview/bali', 'web:preview/lima', 'api:preview/oslo']);
    expect(result.jobsByBranch[2]?.source.region).toBe('eu-west-1');
    expect(byApp.web.listJobs).not.toHaveBeenCalledWith('web', 'main', 5);
  });

  it('reports no branch when nothing matches', async () => {
    const result = await collectRowJobs([source('web')], 'release/*', () =>
      reader({ branches: ['main'] }),
    );
    expect(result).toEqual({ jobsByBranch: [], branchExists: false });
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
