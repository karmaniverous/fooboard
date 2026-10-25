/**
 * Simulated Amplify jobs (spec.md §3.14 *Engine*): an app builds a branch
 * when the scenario repo its `repository` names gets a push to that
 * branch, when the branch builds on its own schedule (an app whose repo
 * isn't simulated), and at each pinned job's time. Each job waits in the
 * queue, runs for a drawn duration and ends as drawn from the branch's
 * outcome pattern (or pinned). Job ids count up per branch, as Amplify's
 * do. Pure in the scenario, seed and time.
 *
 * @module
 */
import { buildsRepo } from '@/domain/matching/repoUrl';

import { branchAt, type Commit, commitSha, repoHistory } from './history';
import { between, type Random, seededRandom } from './random';
import type { App, DemoScenario, JobOutcome } from './scenario';

export interface SimAppJob {
  /** `1`, `2`, … per branch. */
  id: string;
  commit: Commit;
  createdAt: number;
  startAt: number;
  endAt: number;
  outcome: JobOutcome;
}

type AppBranch = App['branches'][number];

/** Draw an outcome from the branch's pattern. */
function drawOutcome(branch: AppBranch, random: Random): JobOutcome {
  const roll = random();
  if (roll < branch.outcomes.failure) return 'failure';
  return roll < branch.outcomes.failure + branch.outcomes.cancelled
    ? 'cancelled'
    : 'success';
}

interface Trigger {
  at: number;
  commit: Commit;
  pinned?: { outcome: JobOutcome; queueMs?: number; durationMs?: number };
}

/** What starts `app`'s jobs on `branch` up to `until`. */
function triggers(
  scenario: DemoScenario,
  seed: number,
  app: App,
  branch: AppBranch,
  until: number,
): Trigger[] {
  const start = -scenario.historyMs;
  const repo = scenario.github.repos.find((r) =>
    buildsRepo(app.repository, r.fullName),
  );
  const history = repo ? repoHistory(scenario, seed, repo, until) : undefined;
  const list: Trigger[] = history
    ? history.pushes
        .filter((p) => p.branch === branch.name && p.at <= until)
        .map((p) => ({ at: p.at, commit: p.head }))
    : [];
  if (branch.everyMs) {
    const random = seededRandom(seed, `${app.appId}:${branch.name}:builds`);
    let n = 0;
    for (
      let t = start + between(random, branch.everyMs);
      t <= until;
      t += Math.max(1, between(random, branch.everyMs))
    ) {
      const sha = commitSha(seed, `${app.appId}/${branch.name}`, n);
      list.push({
        at: t,
        commit: { n, sha, at: t, message: 'Update content' },
      });
      n += 1;
    }
  }
  for (const e of scenario.pinned) {
    if (
      e.kind !== 'appJob' ||
      e.appId !== app.appId ||
      e.branch !== branch.name ||
      e.at > until
    )
      continue;
    const head = history
      ? branchAt(history, branch.name, e.at)?.head
      : undefined;
    const commit = head ?? {
      n: -1,
      sha: commitSha(seed, `${app.appId}/${branch.name}/pinned`, e.at),
      at: e.at,
      message: 'Redeploy',
    };
    list.push({ at: e.at, commit, pinned: e });
  }
  return list.sort((a, b) => a.at - b.at); // stable: ties keep list order
}

/** Every job of `app` on `branch` created by `until`, oldest first. */
export function appBranchJobs(
  scenario: DemoScenario,
  seed: number,
  app: App,
  branchName: string,
  until: number,
): SimAppJob[] {
  const branch = app.branches.find((b) => b.name === branchName);
  if (!branch) return [];
  return triggers(scenario, seed, app, branch, until).map((tr, i) => {
    const random = seededRandom(
      seed,
      `${app.appId}:${branch.name}:job:${String(i)}`,
    );
    const queueMs = tr.pinned?.queueMs ?? between(random, branch.queueMs);
    const durationMs =
      tr.pinned?.durationMs ?? between(random, branch.durationMs);
    const outcome = tr.pinned?.outcome ?? drawOutcome(branch, random);
    const startAt = tr.at + queueMs;
    const endAt =
      startAt +
      (outcome === 'cancelled' ? Math.round(durationMs / 2) : durationMs);
    return {
      id: String(i + 1),
      commit: tr.commit,
      createdAt: tr.at,
      startAt,
      endAt,
      outcome,
    };
  });
}

/** Amplify's status of `job` at `t`. */
export function appJobStatus(
  job: SimAppJob,
  t: number,
): 'PENDING' | 'RUNNING' | 'SUCCEED' | 'FAILED' | 'CANCELLED' {
  if (t < job.startAt) return 'PENDING';
  if (t < job.endAt) return 'RUNNING';
  return job.outcome === 'success'
    ? 'SUCCEED'
    : job.outcome === 'failure'
      ? 'FAILED'
      : 'CANCELLED';
}
