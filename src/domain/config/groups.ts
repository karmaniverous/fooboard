/**
 * Zod schemas for row and column groups (spec.md C-14b, replacing
 * dividers): an optional, labelled set of adjacent rows or stages. Groups
 * are one level deep; ungrouped rows and stages may sit between them. A
 * row group is also an override level (C-14c) and may set default
 * credentials (C-1a).
 *
 * @module
 */
import { z } from 'zod';

import { DefaultCredentialsSchema } from './credentialRefs';
import {
  GroupStageRulesSchema,
  ProviderRowRulesSchema,
  ProviderRulesSchema,
} from './placement';
import { StatusSetRefsSchema } from './statusSets';

/** What every group has: an id, an optional label, and its members (row
 * or stage ids, in board order). Created from a member, so never empty. */
const GroupSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).optional(),
  memberIds: z.array(z.string().min(1)).min(1),
});
export type Group = z.infer<typeof GroupSchema>;

/** A row group: also an override level for stage rules (C-14c), the row
 * axis's rules, default credentials (C-1a) and status sets per provider. */
export const RowGroupSchema = GroupSchema.extend({
  stageRules: GroupStageRulesSchema.default(() => ({})),
  rowRules: ProviderRowRulesSchema.default(() => ({})),
  defaultCredentials: DefaultCredentialsSchema.default(() => ({})),
  statusSets: StatusSetRefsSchema.default(() => ({})),
});
export type RowGroup = z.infer<typeof RowGroupSchema>;

/** A column group: default stage rules per source for its stages
 * (spec.md A§4.3.7). */
export const ColumnGroupSchema = GroupSchema.extend({
  stageRules: ProviderRulesSchema.default(() => ({})),
});
export type ColumnGroup = z.infer<typeof ColumnGroupSchema>;

/** The group `id` (a row or stage id) belongs to, if any. */
export function groupOf<G extends Pick<Group, 'memberIds'>>(
  groups: readonly G[],
  id: string,
): G | undefined {
  return groups.find((g) => g.memberIds.includes(id));
}
