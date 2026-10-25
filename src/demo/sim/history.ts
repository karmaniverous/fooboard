/**
 * A simulated repo's git history (spec.md §3.14 *Engine*): commits land on
 * the branches the scenario marks as taking them, at seeded intervals;
 * promotions move a branch to its source's head on their schedule
 * (fast-forward, or a merge commit when the target has commits of its
 * own); pinned commits and promotions happen at their fixed times. Every
 * branch starts at one root commit when history starts, before the demo
 * opens. A branch's state at any time is a lookup in the timeline, which
 * is generated once per scenario, seed and repo, and extended as time
 * goes on. Pure: the same scenario, seed and time give the same history.
 *
 * @module
 */
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';

import { between, pick, seededRandom } from './random';
import type { DemoScenario, Repo } from './scenario';

/** One commit; `n` orders a repo's commits. */
export interface Commit {
  n: number;
  sha: string;
  at: number;
  message: string;
}

/** A branch from `at` on: its head and every commit it contains. */
interface BranchState {
  at: number;
  head: Commit;
  commits: ReadonlySet<number>;
}

/** A branch's head moved (a commit or a promotion): what starts runs. */
export interface Push {
  at: number;
  branch: string;
  head: Commit;
}

export interface RepoHistory {
  /** Generated up to this time. */
  horizon: number;
  commits: readonly Commit[];
  pushes: readonly Push[];
  states: ReadonlyMap<string, readonly BranchState[]>;
}

/** How much further than asked the timeline is generated at once. */
const EXTEND_MS = 60 * 60_000;

/** A SHA's length in hex digits. */
const SHA_LENGTH = 40;

/** Commit messages for simulated work; one has a body (the detail
 * sheet's richest detail shows it, C-13). */
const MESSAGES = [
  'Fix flaky checkout test',
  'Bump dependencies',
  'Add retry to payment webhook\n\nRetries a failed delivery three times, backing off.',
  'Tune cache headers',
  'Refactor auth middleware',
  'Log slow queries',
  'Speed up the search index build',
  'Handle empty carts',
  'Add pagination to the orders API',
  'Rotate signing keys',
] as const;

/** A commit's SHA: stable for its scenario seed, repo and number. */
export const commitSha = (seed: number, repo: string, n: number): string =>
  bytesToHex(sha256(utf8ToBytes(`${String(seed)}:${repo}:${String(n)}`))).slice(
    0,
    SHA_LENGTH,
  );

type Event =
  | { at: number; kind: 'commit'; branch: string; message?: string }
  | { at: number; kind: 'promote'; from: string; to: string };

/** Every event of `repo` from `start` to `until`, in time order. */
function events(
  scenario: DemoScenario,
  seed: number,
  repo: Repo,
  start: number,
  until: number,
): Event[] {
  const list: Event[] = [];
  for (const branch of repo.branches) {
    if (!branch.commitsEveryMs) continue;
    const random = seededRandom(
      seed,
      `${repo.fullName}:commits:${branch.name}`,
    );
    for (
      let t = start + between(random, branch.commitsEveryMs);
      t <= until;
      t += Math.max(1, between(random, branch.commitsEveryMs))
    )
      list.push({ at: t, kind: 'commit', branch: branch.name });
  }
  const has = (name: string) => repo.branches.some((b) => b.name === name);
  for (const p of scenario.promotions) {
    if (!has(p.from) || !has(p.to)) continue;
    const random = seededRandom(
      seed,
      `${repo.fullName}:promote:${p.from}>${p.to}`,
    );
    for (let t = start + random() * p.everyMs; t <= until; t += p.everyMs)
      list.push({ at: Math.round(t), kind: 'promote', from: p.from, to: p.to });
  }
  for (const e of scenario.pinned) {
    if (e.kind === 'commit' && e.repo === repo.fullName && e.at <= until)
      list.push({
        at: e.at,
        kind: 'commit',
        branch: e.branch,
        message: e.message,
      });
    if (e.kind === 'promote' && e.repo === repo.fullName && e.at <= until)
      list.push({ at: e.at, kind: 'promote', from: e.from, to: e.to });
  }
  // Stable: at one time, commits before promotions, each in list order.
  const rank = (e: Event) => (e.kind === 'commit' ? 0 : 1);
  return list.sort((a, b) => a.at - b.at || rank(a) - rank(b));
}

const isSubset = (a: ReadonlySet<number>, b: ReadonlySet<number>): boolean =>
  [...a].every((n) => b.has(n));

/** Generate `repo`'s history up to `until`. */
function generate(
  scenario: DemoScenario,
  seed: number,
  repo: Repo,
  until: number,
): RepoHistory {
  const start = -scenario.historyMs;
  const commits: Commit[] = [];
  const pushes: Push[] = [];
  const states = new Map<string, BranchState[]>();
  const messages = seededRandom(seed, `${repo.fullName}:messages`);
  const commit = (at: number, message: string): Commit => {
    const c = {
      n: commits.length,
      sha: commitSha(seed, repo.fullName, commits.length),
      at,
      message,
    };
    commits.push(c);
    return c;
  };
  const root = commit(start, 'Initial commit');
  for (const b of repo.branches)
    states.set(b.name, [{ at: start, head: root, commits: new Set([root.n]) }]);
  const current = (branch: string): BranchState => {
    const list = states.get(branch) ?? [];
    const last = list.at(-1);
    if (!last) throw new Error(`no branch ${branch} in ${repo.fullName}`);
    return last;
  };
  const move = (branch: string, state: BranchState): void => {
    states.get(branch)?.push(state);
    pushes.push({ at: state.at, branch, head: state.head });
  };
  for (const e of events(scenario, seed, repo, start, until)) {
    if (e.kind === 'commit') {
      const before = current(e.branch);
      const c = commit(e.at, e.message ?? pick(messages, MESSAGES));
      move(e.branch, {
        at: e.at,
        head: c,
        commits: new Set([...before.commits, c.n]),
      });
      continue;
    }
    const from = current(e.from);
    const to = current(e.to);
    if (isSubset(from.commits, to.commits)) continue; // nothing to promote
    if (isSubset(to.commits, from.commits)) {
      move(e.to, { at: e.at, head: from.head, commits: new Set(from.commits) });
      continue;
    }
    const merge = commit(e.at, `Merge branch '${e.from}' into ${e.to}`);
    move(e.to, {
      at: e.at,
      head: merge,
      commits: new Set([...to.commits, ...from.commits, merge.n]),
    });
  }
  return { horizon: until, commits, pushes, states };
}

const cache = new WeakMap<DemoScenario, Map<string, RepoHistory>>();

/** `repo`'s history, generated at least up to `until`. */
export function repoHistory(
  scenario: DemoScenario,
  seed: number,
  repo: Repo,
  until: number,
): RepoHistory {
  let byRepo = cache.get(scenario);
  if (!byRepo) {
    byRepo = new Map();
    cache.set(scenario, byRepo);
  }
  const key = `${String(seed)}:${repo.fullName}`;
  const hit = byRepo.get(key);
  if (hit && hit.horizon >= until) return hit;
  const next = generate(
    scenario,
    seed,
    repo,
    Math.max(until, (hit?.horizon ?? until) + EXTEND_MS),
  );
  byRepo.set(key, next);
  return next;
}

/** `branch` as it is at `t`, if the repo has it. */
export function branchAt(
  history: RepoHistory,
  branch: string,
  t: number,
): BranchState | undefined {
  const states = history.states.get(branch) ?? [];
  let found: BranchState | undefined;
  for (const s of states) {
    if (s.at > t) break;
    found = s;
  }
  return found;
}

/** `base...head` at `t`: the commits `head` has that `base` lacks
 * (oldest first), and the reverse; `undefined` if either is missing. */
export function compareAt(
  history: RepoHistory,
  base: string,
  head: string,
  t: number,
): { ahead: Commit[]; behind: Commit[] } | undefined {
  const b = branchAt(history, base, t);
  const h = branchAt(history, head, t);
  if (!b || !h) return undefined;
  const only = (x: BranchState, y: BranchState) =>
    history.commits.filter((c) => x.commits.has(c.n) && !y.commits.has(c.n));
  return { ahead: only(h, b), behind: only(b, h) };
}
