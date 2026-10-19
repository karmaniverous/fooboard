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
  keep: RuleSchema.default({ combine: 'and', checks: [] }),
  /** The key that orders records, newest last. */
  order: z.string().min(1),
};

/** What the GitHub reader asks for. */
const GithubReaderSchema = z.object({
  /** Filtered in the browser: the runs API can't exclude an event. */
  excludePullRequests: z.boolean().default(true),
  runs: z.number().int().min(1).max(500).default(100),
});

/** What the Amplify reader asks for. */
const AmplifyReaderSchema = z.object({
  jobsPerBranch: z.number().int().min(1).max(100).default(20),
  /** Over one entry of Amplify's branch list; empty: every branch. */
  branches: RuleSchema.default({ combine: 'and', checks: [] }),
});

export const SourceRuleSchema = z.discriminatedUnion('provider', [
  z.object({
    ...base,
    provider: z.literal('github'),
    reader: GithubReaderSchema.default({
      excludePullRequests: true,
      runs: 100,
    }),
  }),
  z.object({
    ...base,
    provider: z.literal('amplify'),
    reader: AmplifyReaderSchema.default({
      jobsPerBranch: 20,
      branches: { combine: 'and', checks: [] },
    }),
  }),
]);
export type SourceRule = z.infer<typeof SourceRuleSchema>;
