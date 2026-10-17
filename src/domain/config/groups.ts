/**
 * Zod schema for row and column groups (spec.md C-14b, replacing
 * dividers): an optional, labelled set of adjacent rows or stages. Groups
 * are one level deep; ungrouped rows and stages may sit between them. A
 * row group is also an override level (C-14c) and may set default
 * credentials (C-1a).
 *
 * @module
 */
import { z } from 'zod';

import { DefaultCredentialsSchema } from './credentialRefs';

/** Per-stage branch-pattern overrides, keyed by stage id (C-14c). */
export const BranchPatternOverridesSchema = z.record(
  z.string().min(1),
  z.string().min(1),
);
export type BranchPatternOverrides = z.infer<
  typeof BranchPatternOverridesSchema
>;

/**
 * A row group: a labelled or unlabelled set of adjacent rows, created from
 * a member and removed when its last member leaves (spec.md C-14b, C-21).
 * Carries branch-pattern overrides and default credentials, both an
 * override level (C-14c, C-1a).
 */
export const RowGroupSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).optional(),
  memberIds: z.array(z.string().min(1)).min(1),
  branchPatternOverrides: BranchPatternOverridesSchema.default(() => ({})),
  defaultCredentials: DefaultCredentialsSchema.default(() => ({})),
});
export type RowGroup = z.infer<typeof RowGroupSchema>;

/**
 * A column group: a labelled or unlabelled set of adjacent stages.
 * Column groups carry no overrides: columns cut across providers
 * (spec.md C-14b).
 */
export const ColumnGroupSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).optional(),
  memberIds: z.array(z.string().min(1)).min(1),
});
export type ColumnGroup = z.infer<typeof ColumnGroupSchema>;

/** The row group a row belongs to, if any. */
export function rowGroupOf(
  rowGroups: readonly RowGroup[],
  rowId: string,
): RowGroup | undefined {
  return rowGroups.find((g) => g.memberIds.includes(rowId));
}

/** The column group a stage belongs to, if any. */
export function columnGroupOf(
  columnGroups: readonly ColumnGroup[],
  stageId: string,
): ColumnGroup | undefined {
  return columnGroups.find((g) => g.memberIds.includes(stageId));
}
