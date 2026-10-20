/**
 * Source rules (spec.md A§4.3.7): one per source, turning a source's raw
 * data into records. Each key is an ordered list of translations (the
 * first whose rule matches gives the value, or copies one from a path; a
 * translation with no checks is a catch-all). A source rule may say where
 * the raw data's items are and how to translate each, which records to
 * keep, which key orders records, and what its reader asks for.
 *
 * @module
 */
import { z } from 'zod';

import type { Provider } from '@/domain/config/providers';
import { always } from '@/domain/rules/always';
import { RuleSchema } from '@/domain/rules/schema';

/** One translation: a rule and the value it gives, or a path to copy. */
const TranslationSchema = z.union([
  z.object({ rule: RuleSchema, value: z.string() }),
  z.object({ rule: RuleSchema, copy: z.string().min(1) }),
]);
export type Translation = z.infer<typeof TranslationSchema>;

/** One record or item key and its translations, tried in order. */
const KeySchema = z.object({
  name: z.string().min(1),
  translations: z.array(TranslationSchema),
});
export type KeyDef = z.infer<typeof KeySchema>;

const base = {
  id: z.string().min(1),
  name: z.string().min(1),
  keys: z.array(KeySchema),
  /** Where the raw data's items are, and their keys. */
  items: z
    .object({ path: z.string().min(1), keys: z.array(KeySchema) })
    .optional(),
  /** Records failing this are dropped before placement. */
  keep: RuleSchema.default(always),
  /** The key that orders records, newest last. */
  order: z.string().min(1),
};

/** The fewest runs or jobs a reader may ask for. */
export const MIN_READ = 1;
/** The most runs the GitHub reader may read per repo, and its default. */
export const MAX_GITHUB_RUNS = 500;
export const DEFAULT_GITHUB_RUNS = 100;
/** The most jobs the Amplify reader may read per branch, and its default. */
export const MAX_AMPLIFY_JOBS_PER_BRANCH = 100;
export const DEFAULT_AMPLIFY_JOBS_PER_BRANCH = 20;

/** What the GitHub reader asks for, by default. */
const GITHUB_READER_DEFAULTS = {
  excludePullRequests: true,
  runs: DEFAULT_GITHUB_RUNS,
};

/** What the Amplify reader asks for, by default: every branch. */
export const AMPLIFY_READER_DEFAULTS = {
  jobsPerBranch: DEFAULT_AMPLIFY_JOBS_PER_BRANCH,
  branches: always,
};

/** What the GitHub reader asks for. */
const GithubReaderSchema = z.object({
  /** Filtered in the browser: the runs API can't exclude an event. */
  excludePullRequests: z
    .boolean()
    .default(GITHUB_READER_DEFAULTS.excludePullRequests),
  runs: z
    .number()
    .int()
    .min(MIN_READ)
    .max(MAX_GITHUB_RUNS)
    .default(DEFAULT_GITHUB_RUNS),
});

/** What the Amplify reader asks for. */
const AmplifyReaderSchema = z.object({
  jobsPerBranch: z
    .number()
    .int()
    .min(MIN_READ)
    .max(MAX_AMPLIFY_JOBS_PER_BRANCH)
    .default(DEFAULT_AMPLIFY_JOBS_PER_BRANCH),
  /** Over one entry of Amplify's branch list; empty: every branch. */
  branches: RuleSchema.default(always),
});
export type AmplifyReaderOptions = z.infer<typeof AmplifyReaderSchema>;

export const SourceRuleSchema = z.discriminatedUnion('provider', [
  z.object({
    ...base,
    provider: z.literal('github'),
    reader: GithubReaderSchema.default(GITHUB_READER_DEFAULTS),
  }),
  z.object({
    ...base,
    provider: z.literal('amplify'),
    reader: AmplifyReaderSchema.default(AMPLIFY_READER_DEFAULTS),
  }),
]);
export type SourceRule = z.infer<typeof SourceRuleSchema>;

/** The source rule for `provider`. */
export type SourceRuleOf<P extends Provider> = Extract<
  SourceRule,
  { provider: P }
>;

/** Is `rule` for `provider`? */
export const isSourceRuleFor = <P extends Provider>(
  rule: SourceRule | undefined,
  provider: P,
): rule is SourceRuleOf<P> => rule?.provider === provider;
