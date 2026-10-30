/**
 * `/ai.schema.json` (spec 0.2.0 §3.J, Decisions 87 and 95): the JSON
 * Schema of a share as this version reads it, with no secrets, generated
 * from the zod schemas (`AiShareSchema`) in their input form, so fields
 * with defaults are optional. The committed file is this test's file
 * snapshot: CI and the release hooks fail while it is out of date, and
 * `npm run ai:schema` rewrites it.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { CredentialRefSchema } from '@/domain/config/credentials';
import { DashboardSchema } from '@/domain/config/dashboard';
import { ColumnGroupSchema, RowGroupSchema } from '@/domain/config/groups';
import { ProviderRulesSchema } from '@/domain/config/placement';
import { RowSchema } from '@/domain/config/row';
import { StageSchema } from '@/domain/config/stage';
import { StatusSetSchema } from '@/domain/config/statusSets';
import { UnmappedDismissalSchema } from '@/domain/config/unmappedDismissals';
import { SourceRuleSchema } from '@/domain/model/sourceRule';
import { CheckSchema, RuleSchema } from '@/domain/rules/schema';
import { SettingsSchema } from '@/domain/settings/schema';
import { AiShareSchema } from '@/share/envelope';

/** The committed schema, relative to this file. */
const SCHEMA_FILE = '../../public/ai.schema.json';

/** Names for the share's parts: each is defined once, in `$defs`, and
 * referred to by name wherever it is used. */
const names = z.registry<{
  id?: string;
  title?: string;
  description?: string;
}>();
// The share's own title and description (`AiShareSchema.meta`).
names.add(AiShareSchema, AiShareSchema.meta() ?? {});
for (const [schema, id] of [
  [DashboardSchema, 'Dashboard'],
  [RowSchema, 'Row'],
  [StageSchema, 'Stage'],
  [RowGroupSchema, 'RowGroup'],
  [ColumnGroupSchema, 'ColumnGroup'],
  [CredentialRefSchema, 'CredentialRef'],
  [ProviderRulesSchema, 'ProviderRules'],
  [RuleSchema, 'Rule'],
  [CheckSchema, 'Check'],
  [SettingsSchema, 'Settings'],
  [StatusSetSchema, 'StatusSet'],
  [SourceRuleSchema, 'SourceRule'],
  [UnmappedDismissalSchema, 'UnmappedDismissal'],
] as const)
  names.add(schema, { id });

/** The schema as `/ai.schema.json` serves it. */
const aiSchema = (): string =>
  `${JSON.stringify(
    z.toJSONSchema(AiShareSchema, {
      target: 'draft-2020-12',
      io: 'input',
      metadata: names,
    }),
    null,
    2,
  )}\n`;

describe('/ai.schema.json', () => {
  it('is the JSON Schema of AiShareSchema, as committed', async () => {
    await expect(aiSchema()).toMatchFileSnapshot(SCHEMA_FILE);
  });
});
