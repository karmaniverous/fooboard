/**
 * Zod schemas for the GitHub REST payloads this adapter reads (spec.md §4.3,
 * §5). Only the fields the adapter uses are validated; everything else on
 * the response is ignored. Types are derived with `z.infer`, so the schema
 * is the single source of truth.
 *
 * @module
 */
import { z } from 'zod';

/** One GitHub Actions workflow run (spec.md 4.3.2). Not exported: only
 * the envelope schema below is consumed outside this module. */
const WorkflowRunSchema = z.object({
  id: z.number(),
  name: z.string().nullable().optional(),
  head_branch: z.string().nullable(),
  head_sha: z.string(),
  /** The head commit; its message is the board's richest detail (C-13). */
  head_commit: z.object({ message: z.string() }).nullable().optional(),
  status: z.string().nullable(),
  conclusion: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  run_attempt: z.number().optional(),
  html_url: z.string(),
  workflow_id: z.number(),
  /** What triggered the run, e.g. `push`, `pull_request` (spec.md §4.3.1:
   * `pull_request`/`pull_request_target` runs are excluded). */
  event: z.string(),
  /** The run's repo as GitHub names it now: a renamed repo's runs carry
   * the new name (Decision 26). */
  repository: z.object({ full_name: z.string() }).optional(),
});
export type WorkflowRun = z.infer<typeof WorkflowRunSchema>;

/** `GET /repos/{owner}/{repo}/actions/runs` response envelope. */
export const WorkflowRunsResponseSchema = z.object({
  total_count: z.number(),
  workflow_runs: z.array(WorkflowRunSchema),
});

/** One job within a workflow run's latest attempt (spec.md 4.3.2-4.3.3). */
const JobSchema = z.object({
  id: z.number(),
  run_id: z.number(),
  name: z.string(),
  status: z.string(),
  conclusion: z.string().nullable(),
  started_at: z.string().nullable().optional(),
  completed_at: z.string().nullable().optional(),
  html_url: z.string().nullable(),
  run_attempt: z.number().optional(),
});
export type Job = z.infer<typeof JobSchema>;

/** `GET /repos/{owner}/{repo}/actions/runs/{run_id}/jobs` response envelope. */
export const JobsResponseSchema = z.object({
  total_count: z.number(),
  jobs: z.array(JobSchema),
});

/** One ref returned by matching-refs (spec.md 4.3.5: "no branch" check). */
const MatchingRefSchema = z.object({
  ref: z.string(),
  object: z.object({ sha: z.string() }),
});
export type MatchingRef = z.infer<typeof MatchingRefSchema>;

/** `GET /repos/{owner}/{repo}/git/matching-refs/{ref}` response body. */
export const MatchingRefsSchema = z.array(MatchingRefSchema);

/** One commit as it appears in a compare response. */
const CompareCommitSchema = z.object({
  sha: z.string(),
  commit: z.object({ message: z.string() }),
});

/** `GET /repos/{owner}/{repo}/compare/{basehead}` response (spec.md §3). */
export const CompareSchema = z.object({
  ahead_by: z.number(),
  behind_by: z.number(),
  html_url: z.string(),
  commits: z.array(CompareCommitSchema),
});
export type CompareApiResult = z.infer<typeof CompareSchema>;

/** A branch, for the stage editor's branch list and staleness fallback. */
const BranchSchema = z.object({
  name: z.string(),
  commit: z.object({ sha: z.string() }),
});
export type Branch = z.infer<typeof BranchSchema>;

/** `GET /repos/{owner}/{repo}/branches` response: a plain array, paginated. */
export const BranchesResponseSchema = z.array(BranchSchema);

/** A repo visible to the token, for the row editor's repo picker (C-21). */
const RepoSchema = z.object({
  full_name: z.string(),
  name: z.string(),
  private: z.boolean(),
  html_url: z.string(),
  owner: z.object({ login: z.string() }),
});
export type Repo = z.infer<typeof RepoSchema>;

/** `GET /user/repos` response: a plain array, paginated. */
export const ReposResponseSchema = z.array(RepoSchema);
