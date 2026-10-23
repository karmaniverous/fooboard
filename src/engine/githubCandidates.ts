/**
 * A GitHub repo's candidate runs (spec.md §3.1, §2.3): the runs pages a
 * token's rows read, de-duplicated by run id across pages, cut to the
 * source rule's window, translated to shallow records (run fields only),
 * kept by a shallow `keep` rule and ordered newest first by the source's
 * order key. Memoized on the pages' data, so rows sharing a repo and
 * re-deriving after a jobs landing don't translate again. Pure.
 *
 * @module
 */
import { unique } from 'radash';

import { isExcludedEvent } from '@/domain/derivation';
import { ruleNeedsItems } from '@/domain/model/cell';
import { asJson } from '@/domain/model/json';
import type { SourceRuleOf } from '@/domain/model/sourceRule';
import {
  compareOrder,
  type KeyProblem,
  orderOf,
  type RecordDoc,
  translate,
} from '@/domain/model/translate';
import { evaluateRule } from '@/domain/rules/check';
import {
  type Fetched,
  type Job,
  mapRunWithJobs,
  mapWorkflowRun,
  type WorkflowRun,
} from '@/lib/github';

/** A run that may feed a cell, with its shallow record. */
export interface Candidate {
  run: WorkflowRun;
  shallow: RecordDoc;
}

/** A repo's candidates and what reading them found. */
export interface Candidates {
  candidates: Candidate[];
  /** Record-scope translation problems. */
  keyProblems: KeyProblem[];
  /** The window filled: older runs may have been cut (window hints). */
  full: boolean;
  /** The source's `keep` rule tests items: judged once jobs land. */
  keepDeep: boolean;
}

type GithubSource = SourceRuleOf<'github'>;

const memo = new WeakMap<GithubSource, { pages: unknown[]; out: Candidates }>();

const samePages = (a: readonly unknown[], b: readonly unknown[]) =>
  a.length === b.length && a.every((p, i) => p === b[i]);

/** The candidates in `pages` (in page order) under `source`. */
export function githubCandidates(
  source: GithubSource,
  pages: readonly Fetched<WorkflowRun[]>[],
): Candidates {
  const hit = memo.get(source);
  if (hit && samePages(hit.pages, pages)) return hit.out;
  const { runs, excludePullRequests } = source.reader;
  const raw = unique(
    pages.flatMap((page) => page.data),
    (run) => run.id,
  ).slice(0, runs);
  const keyProblems: KeyProblem[] = [];
  const keepDeep = ruleNeedsItems(source.keep);
  const order = (r: RecordDoc) => orderOf(r, source.order);
  const candidates = raw
    .filter((run) => !(excludePullRequests && isExcludedEvent(run.event)))
    .map((run) => {
      const { record, problems } = translate(
        source,
        asJson({ run: mapWorkflowRun(run), jobs: [] }),
      );
      keyProblems.push(...problems.filter((p) => p.scope === 'record'));
      return { run, shallow: record };
    })
    .filter((c) => keepDeep || evaluateRule(source.keep, c.shallow))
    .sort((a, b) => compareOrder(order(b.shallow), order(a.shallow)));
  const out = { candidates, keyProblems, full: raw.length >= runs, keepDeep };
  memo.set(source, { pages: [...pages], out });
  return out;
}

/** A full record and its item-scope translation problems. */
interface Full {
  record: RecordDoc;
  problems: KeyProblem[];
}

const fullMemo = new WeakMap<
  readonly Job[],
  { source: GithubSource; run: WorkflowRun; out: Full }
>();

/** A run's full record once all its jobs pages landed (`jobs` must be a
 * stable array per landing, which `jobsOf` gives), with item-scope
 * translation problems. */
export function fullRecord(
  source: GithubSource,
  run: WorkflowRun,
  jobs: readonly Job[],
): Full {
  const hit = fullMemo.get(jobs);
  if (hit?.source === source && hit.run === run) return hit.out;
  const { record, problems } = translate(
    source,
    asJson(mapRunWithJobs(run, [...jobs])),
  );
  const out = {
    record,
    problems: problems.filter((p) => p.scope === 'item'),
  };
  fullMemo.set(jobs, { source, run, out });
  return out;
}
