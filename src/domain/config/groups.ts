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
import { StatusSetRefsSchema } from './statusSets';

/** Per-stage branch-pattern overrides, keyed by stage id (C-14c). */
export const BranchPatternOverridesSchema = z.record(
  z.string().min(1),
  z.string().min(1),
);
export type BranchPatternOverrides = z.infer<
  typeof BranchPatternOverridesSchema
>;

/** What every group has: an id, an optional label, and its members (row
 * or stage ids, in board order). Created from a member, so never empty. */
const GroupSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).optional(),
  memberIds: z.array(z.string().min(1)).min(1),
});
export type Group = z.infer<typeof GroupSchema>;

/** A row group: also an override level for branch patterns (C-14c),
 * default credentials (C-1a) and status sets per provider (A§4.3.6). */
export const RowGroupSchema = GroupSchema.extend({
  branchPatternOverrides: BranchPatternOverridesSchema.default(() => ({})),
  defaultCredentials: DefaultCredentialsSchema.default(() => ({})),
  statusSets: StatusSetRefsSchema.default(() => ({})),
});
export type RowGroup = z.infer<typeof RowGroupSchema>;

/** A column group carries nothing more: columns cut across providers, so
 * they are no override level (spec.md C-14b). */
export const ColumnGroupSchema = GroupSchema;
export type ColumnGroup = z.infer<typeof ColumnGroupSchema>;

/** The group `id` (a row or stage id) belongs to, if any. */
export function groupOf<G extends Pick<Group, 'memberIds'>>(
  groups: readonly G[],
  id: string,
): G | undefined {
  return groups.find((g) => g.memberIds.includes(id));
}
