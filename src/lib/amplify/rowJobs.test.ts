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
  it('reads every branch, tagged by source', async () => {
    const byApp: Record<string, ReturnType<typeof reader>> = {
      web: reader({ branches: ['main', 'preview/bali', 'preview/lima'] }),
      api: reader({ branches: ['preview/oslo'] }),
    };
    const readerFor = vi.fn(() => byApp.web);
    readerFor.mockReturnValueOnce(byApp.web).mockReturnValueOnce(byApp.api);

    const result = await collectRowJobs(
      [source('web'), source('api', 'eu-west-1')],
      readerFor,
    );

    expect(result.map((j) => `${j.source.appId}:${j.branch}`)).toEqual([
      'web:main',
      'web:preview/bali',
      'web:preview/lima',
      'api:preview/oslo',
    ]);
    expect(result[3]?.source.region).toBe('eu-west-1');
  });

  it('reads only branches the branch rule keeps, and jobs per branch', async () => {
    const app = reader({ branches: ['main', 'preview/bali', 'feature/x'] });
    const result = await collectRowJobs([source('web')], () => app, {
      jobsPerBranch: 7,
      branches: {
        combine: 'or',
        checks: [
          {
            path: '$.branchName',
            operator: 'glob',
            value: 'main',
            ignoreCase: true,
            quantifier: 'any',
            not: false,
          },
          {
            path: '$.branchName',
            operator: 'glob',
            value: 'preview/*',
            ignoreCase: true,
            quantifier: 'any',
            not: false,
          },
        ],
      },
    });
    expect(result.map((j) => j.branch)).toEqual(['main', 'preview/bali']);
    expect(app.listJobs).toHaveBeenCalledWith('web', 'main', 7);
    expect(app.listJobs).not.toHaveBeenCalledWith('web', 'feature/x', 7);
  });

  it('reads nothing from an app without branches', async () => {
    const result = await collectRowJobs([source('web')], () =>
      reader({ branches: [] }),
    );
    expect(result).toEqual([]);
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
