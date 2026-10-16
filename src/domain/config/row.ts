/**
 * Zod schema for dashboard rows (spec.md §3): a GitHub row (one repo,
 * optionally narrowed by row key tests) or an Amplify row (one or more
 * sources, each a credential + region + app id, plus the repo it builds
 * from for staleness).
 *
 * @module
 */
import { z } from 'zod';

import { MatchTestSchema } from './matchTest';

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
  rowKeyTests: z.array(MatchTestSchema).default(() => []),
});
export type GithubRow = z.infer<typeof GithubRowSchema>;

/**
 * One Amplify app to read for a row: a credential (AWS account), region
 * and app id. The app id is picked via `ListApps` at edit time, not typed.
 */
export const AmplifySourceSchema = z.object({
  credentialId: z.string().min(1),
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
});
export type AmplifyRow = z.infer<typeof AmplifyRowSchema>;

/** A dashboard row: GitHub or Amplify. */
export const RowSchema = z.discriminatedUnion('type', [
  GithubRowSchema,
  AmplifyRowSchema,
]);
export type Row = z.infer<typeof RowSchema>;
