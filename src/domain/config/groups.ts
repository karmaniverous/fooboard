/**
 * Zod schemas for row and column groups (spec.md C-14b, replacing
 * dividers): an optional, labelled set of adjacent rows or stages. Groups
 * are one level deep; ungrouped rows and stages may sit between them.
 * Each group holds a settings object (spec.md §3.11); a row group is also
 * an override level for stage rules (C-14c) and for its rows' record
 * rule, a column group for its stages' default stage rules.
 *
 * @module
 */
import { z } from 'zod';

import { SettingsSchema } from '@/domain/settings/schema';

import {
  GroupStageRulesSchema,
  ProviderRowRulesSchema,
  ProviderRulesSchema,
} from './placement';

/** What every group has: an id, an optional label, and its members (row
 * or stage ids, in board order). Created from a member, so never empty. */
const GroupSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).optional(),
  memberIds: z.array(z.string().min(1)).min(1),
  /** The group's settings (spec.md §3.11). */
  settings: SettingsSchema.default(() => ({})),
});
export type Group = z.infer<typeof GroupSchema>;

/** What arranging groups needs of one: its id, label and members. */
export type GroupShape = Pick<Group, 'id' | 'label' | 'memberIds'>;

/** A row group: also an override level for stage rules (C-14c) and the
 * row axis's record rules. */
export const RowGroupSchema = GroupSchema.extend({
  stageRules: GroupStageRulesSchema.default(() => ({})),
  rowRules: ProviderRowRulesSchema.default(() => ({})),
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
