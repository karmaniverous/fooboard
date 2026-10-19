/**
 * Zod schema for dashboard rows (spec.md §3): a GitHub row (one repo,
 * optionally narrowed by row key tests) or an Amplify row (one or more
 * sources, each a credential + region + app id, plus the repo it builds
 * from for staleness).
 *
 * @module
 */
import { z } from 'zod';

import { RuleSchema } from '@/domain/rules/schema';

import { RowStageRulesSchema } from './placement';

/** A row's status-set overrides (A§4.3.6): its own set, and one per
 * stage for single cells. Cell beats row beats row group beats dashboard. */
const rowStatusSets = {
  statusSet: z.string().min(1).optional(),
  cellStatusSets: z
    .record(z.string().min(1), z.string().min(1))
    .default(() => ({})),
};

/** `owner/name` GitHub repo identifier. */
export const RepoSchema = z
  .string()
  .min(1)
  .regex(/^[^/\s]+\/[^/\s]+$/, {
    message: 'repo must be "owner/name"',
  });

/** A GitHub row: one repo, optionally narrowed by row key tests. */
export const GithubRowSchema = z.object({
  type: z.literal('github'),
  id: z.string().min(1),
  repo: RepoSchema,
  displayName: z.string().min(1),
  /** Overrides the dashboard's default GitHub token for this row. */
  credentialId: z.string().min(1).optional(),
  /** Per-stage branch-pattern overrides for this row (spec.md C-14c). */
  stageRules: RowStageRulesSchema.default(() => ({})),
  /** Which records belong to this row (spec.md A§4.3.7). */
  recordRule: RuleSchema.optional(),
  /** Which of a record's items belong to this row. */
  itemRule: RuleSchema.optional(),
  ...rowStatusSets,
});
export type GithubRow = z.infer<typeof GithubRowSchema>;

/**
 * One Amplify app to read for a row: region and app id, plus an optional
 * AWS key overriding the dashboard default (for an app in another AWS
 * account). The app id is picked via `ListApps` at edit time, not typed.
 */
export const AmplifySourceSchema = z.object({
  credentialId: z.string().min(1).optional(),
  region: z.string().min(1),
  appId: z.string().min(1),
});
export type AmplifySource = z.infer<typeof AmplifySourceSchema>;

/**
 * An Amplify row: one or more sources (so one row can span apps in
 * different AWS accounts), plus the GitHub repo the app builds from, used
 * for staleness.
 */
export const AmplifyRowSchema = z.object({
  type: z.literal('amplify'),
  id: z.string().min(1),
  sources: z.array(AmplifySourceSchema).min(1),
  repo: RepoSchema,
  displayName: z.string().min(1),
  /** Overrides the dashboard's default GitHub token for `repo`. */
  githubCredentialId: z.string().min(1).optional(),
  /** Per-stage branch-pattern overrides for this row (spec.md C-14c). */
  stageRules: RowStageRulesSchema.default(() => ({})),
  /** Which records belong to this row (spec.md A§4.3.7). */
  recordRule: RuleSchema.optional(),
  /** Which of a record's items belong to this row. */
  itemRule: RuleSchema.optional(),
  ...rowStatusSets,
});
export type AmplifyRow = z.infer<typeof AmplifyRowSchema>;

/** A dashboard row: GitHub or Amplify. */
export const RowSchema = z.discriminatedUnion('type', [
  GithubRowSchema,
  AmplifyRowSchema,
]);
export type Row = z.infer<typeof RowSchema>;
