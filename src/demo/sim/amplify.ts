/**
 * The simulated Amplify API (spec.md §3.14 *Request surface*), reached
 * through the AWS SDK, which signs each request and parses each answer as
 * it would AWS's: `ListApps` in every region (an account's apps only in
 * their region, an empty list elsewhere), `ListBranches` and `ListJobs`,
 * each paged by `maxResults` and `nextToken`, in REST-JSON shapes with
 * times in epoch seconds. Errors carry the status, the
 * `x-amzn-ErrorType` header and a JSON `message`: an unknown app or
 * branch `NotFoundException`, a key the scenario doesn't hold
 * `UnrecognizedClientException`.
 *
 * @module
 */
import { appBranchJobs, appJobStatus, type SimAppJob } from './appJobs';
import type { SimWorld } from './github';
import { json, type SimAnswer, STATUS } from './http';
import type { App } from './scenario';

/** Largest page each list call accepts, and its default. */
const MAX_APPS = 100;
const MAX_BRANCHES_OR_JOBS = 50;
const DEFAULT_MAX_RESULTS = 50;
const MS_PER_SECOND = 1000;
/** Path segments of `/apps/{id}/branches` and of its jobs. */
const BRANCHES_PATH_LENGTH = 3;
const JOBS_PATH_LENGTH = 5;

/** An AWS error answer: status, error type header, JSON message. */
const awsError = (status: number, type: string, message: string): SimAnswer =>
  json(
    status,
    { message },
    {
      'x-amzn-errortype': `${type}:http://internal.amazon.com/coral/com.amazonaws.amplify/`,
    },
  );

const notFound = (message: string) =>
  awsError(STATUS.notFound, 'NotFoundException', message);

/** Epoch seconds, as REST-JSON writes timestamps. */
const seconds = (ms: number): number => ms / MS_PER_SECOND;

/** The page token for an offset, and back. */
const tokenFor = (offset: number): string => btoa(`offset:${String(offset)}`);
function offsetOf(token: string | null): number | undefined {
  if (token === null) return 0;
  try {
    const match = /^offset:(\d+)$/.exec(atob(token));
    return match ? Number(match[1]) : undefined;
  } catch {
    return undefined;
  }
}

/** One page of `items` under `key`, with a `nextToken` while more remain. */
function page(
  url: URL,
  items: readonly unknown[],
  key: string,
  max: number,
): SimAnswer {
  const raw = url.searchParams.get('maxResults');
  const size = raw === null ? DEFAULT_MAX_RESULTS : Number(raw);
  const offset = offsetOf(url.searchParams.get('nextToken'));
  if (!Number.isInteger(size) || size < 1 || size > max || offset === undefined)
    return awsError(
      STATUS.badRequest,
      'BadRequestException',
      'Invalid maxResults or nextToken',
    );
  const next = offset + size;
  const body = { [key]: items.slice(offset, next) };
  return json(
    STATUS.ok,
    next < items.length ? { ...body, nextToken: tokenFor(next) } : body,
  );
}

const arn = (app: App, suffix = '') =>
  `arn:aws:amplify:${app.region}:${app.account}:apps/${app.appId}${suffix}`;

function appBody(app: App, world: SimWorld): Record<string, unknown> {
  const created = seconds(world.at(-world.scenario.historyMs));
  return {
    appId: app.appId,
    appArn: arn(app),
    name: app.name,
    description: '',
    ...(app.repository ? { repository: app.repository } : {}),
    platform: 'WEB',
    createTime: created,
    updateTime: created,
    environmentVariables: {},
    defaultDomain: `${app.appId}.amplifyapp.com`,
    enableBranchAutoBuild: false,
    enableBasicAuth: false,
  };
}

function jobBody(
  app: App,
  branch: string,
  job: SimAppJob,
  t: number,
  world: SimWorld,
): Record<string, unknown> {
  const status = appJobStatus(job, t);
  const ended = status !== 'PENDING' && status !== 'RUNNING';
  return {
    jobArn: arn(app, `/branches/${branch}/jobs/${job.id}`),
    jobId: job.id,
    commitId: job.commit.sha,
    commitMessage: job.commit.message,
    commitTime: seconds(world.at(job.commit.at)),
    startTime: seconds(world.at(job.createdAt)),
    status,
    ...(ended ? { endTime: seconds(world.at(job.endAt)) } : {}),
    jobType: 'RELEASE',
  };
}

/** The access key id a SigV4 `Authorization` header names. */
const accessKeyOf = (headers: Headers): string | undefined =>
  /Credential=([^/,\s]+)\//.exec(headers.get('authorization') ?? '')?.[1];

/** Answer one Amplify request in `region` at simulated time `t`. */
export function amplifyAnswer(
  world: SimWorld,
  region: string,
  request: { url: URL; headers: Headers },
  t: number,
): SimAnswer {
  const keyId = accessKeyOf(request.headers);
  const key = world.scenario.aws.keys.find((k) => k.accessKeyId === keyId);
  if (!key)
    return awsError(
      STATUS.forbidden,
      'UnrecognizedClientException',
      'The security token included in the request is invalid.',
    );
  const apps = world.scenario.aws.apps.filter(
    (a) => a.account === key.account && a.region === region,
  );
  const parts = request.url.pathname
    .split('/')
    .filter(Boolean)
    .map(decodeURIComponent);
  const [root, appId, branches, branchName, jobs] = parts;
  if (root !== 'apps' || parts.length > JOBS_PATH_LENGTH)
    return notFound('Unknown operation');
  if (parts.length === 1)
    return page(
      request.url,
      apps.map((a) => appBody(a, world)),
      'apps',
      MAX_APPS,
    );
  const app = apps.find((a) => a.appId === appId);
  if (!app || branches !== 'branches')
    return notFound(`App ${appId} not found.`);
  if (parts.length === BRANCHES_PATH_LENGTH) {
    const created = seconds(world.at(-world.scenario.historyMs));
    const list = app.branches.map((b) => {
      const count = String(
        appBranchJobs(world.scenario, world.seed, app, b.name, t).length,
      );
      return {
        branchArn: arn(app, `/branches/${b.name}`),
        branchName: b.name,
        displayName: b.name.replace(/\//g, '-'),
        stage: 'PRODUCTION',
        enableNotification: false,
        enableAutoBuild: true,
        enableBasicAuth: false,
        enablePullRequestPreview: false,
        createTime: created,
        updateTime: created,
        environmentVariables: {},
        customDomains: [],
        framework: 'Web',
        activeJobId: count,
        totalNumberOfJobs: count,
        ttl: '5',
      };
    });
    return page(request.url, list, 'branches', MAX_BRANCHES_OR_JOBS);
  }
  if (
    parts.length !== JOBS_PATH_LENGTH ||
    !app.branches.some((b) => b.name === branchName) ||
    jobs !== 'jobs'
  )
    return notFound(`Branch ${branchName} not found.`);
  const newest = appBranchJobs(world.scenario, world.seed, app, branchName, t)
    .reverse()
    .map((j) => jobBody(app, branchName, j, t, world));
  return page(request.url, newest, 'jobSummaries', MAX_BRANCHES_OR_JOBS);
}
