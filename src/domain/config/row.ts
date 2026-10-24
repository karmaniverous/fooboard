/**
 * Zod schema for dashboard rows (spec.md §3, §3.11–3.13): a GitHub row
 * (one repo, optionally narrowed by its record rule) or an Amplify row
 * (the GitHub repo it builds from, when it has one, and its pinned apps).
 * Each row holds its own settings object and one per cell
 * (`cellSettings`, by stage id), beside its per-stage stage rules.
 *
 * @module
 */
import { z } from 'zod';

import { RuleSchema } from '@/domain/rules/schema';
import { SettingsSchema } from '@/domain/settings/schema';

import { RowStageRulesSchema } from './placement';

/** `owner/name` GitHub repo identifier. */
export const RepoSchema = z
  .string()
  .min(1)
  .regex(/^[^/\s]+\/[^/\s]+$/, {
    message: 'repo must be "owner/name"',
  });

/** What every row has beside its source's own fields. */
const rowFields = {
  id: z.string().min(1),
  displayName: z.string().min(1),
  /** Per-stage branch-pattern overrides for this row (spec.md C-14c). */
  stageRules: RowStageRulesSchema.default(() => ({})),
  /** Which records belong to this row (spec.md A§4.3.7). */
  recordRule: RuleSchema.optional(),
  /** The row's own settings (spec.md §3.11). */
  settings: SettingsSchema.default(() => ({})),
  /** Each cell's settings, by stage id (spec.md §3.11). */
  cellSettings: z.record(z.string().min(1), SettingsSchema).default(() => ({})),
};

/** A GitHub row: one repo. */
export const GithubRowSchema = z.object({
  type: z.literal('github'),
  repo: RepoSchema,
  ...rowFields,
});
export type GithubRow = z.infer<typeof GithubRowSchema>;

/**
 * One Amplify app pinned to a row (spec.md §3.12): its region and app id,
 * and optionally the AWS key it serves. A pin with a key serves the cells
 * that resolve to that key; a pin without one, any cell whose key has no
 * keyed pin. The app id is picked via `ListApps`, not typed.
 */
export const PinnedAppSchema = z.object({
  credentialId: z.string().min(1).optional(),
  region: z.string().min(1),
  appId: z.string().min(1),
});
export type PinnedApp = z.infer<typeof PinnedAppSchema>;

/**
 * An Amplify row: the GitHub repo its apps build from (for staleness and,
 * from N3c, for finding them), and its pinned apps. It needs a repo or at
 * least one pin. An app without a connected GitHub repo has none: no
 * badges, and so no GitHub token.
 */
export const AmplifyRowSchema = z
  .object({
    type: z.literal('amplify'),
    repo: RepoSchema.optional(),
    pinnedApps: z.array(PinnedAppSchema).default(() => []),
    ...rowFields,
  })
  .refine((row) => row.repo !== undefined || row.pinnedApps.length > 0, {
    message: 'an Amplify row needs a repo or a pinned app',
    path: ['pinnedApps'],
  });
export type AmplifyRow = z.infer<typeof AmplifyRowSchema>;

/** A dashboard row: GitHub or Amplify. */
export const RowSchema = z.discriminatedUnion('type', [
  GithubRowSchema,
  AmplifyRowSchema,
]);
export type Row = z.infer<typeof RowSchema>;
