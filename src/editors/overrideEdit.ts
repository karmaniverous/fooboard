/**
 * Override editing (spec.md C-14c, C-1a): branch-pattern overrides on a
 * row or a row group, and a row group's default credentials. Pure.
 *
 * @module
 */
import { omit } from 'radash';

import type { CredentialKind } from '@/domain/config/credentials';
import type { Dashboard } from '@/domain/config/dashboard';
import type { RowGroup } from '@/domain/config/groups';

/** One stage's override set, or cleared by an empty pattern. */
function withOverride(
  overrides: Readonly<Record<string, string>>,
  stageId: string,
  pattern: string,
): Record<string, string> {
  const rest = omit(overrides, [stageId]);
  const text = pattern.trim();
  return text ? { ...rest, [stageId]: text } : rest;
}

/** `d` with one row group changed. */
const updateRowGroup = (
  d: Dashboard,
  groupId: string,
  change: (g: RowGroup) => RowGroup,
): Dashboard => ({
  ...d,
  rowGroups: d.rowGroups.map((g) => (g.id === groupId ? change(g) : g)),
});

/** A row's own branch-pattern override for a stage. */
export const setRowOverride = (
  d: Dashboard,
  rowId: string,
  stageId: string,
  pattern: string,
): Dashboard => ({
  ...d,
  rows: d.rows.map((r) =>
    r.id === rowId
      ? {
          ...r,
          branchPatternOverrides: withOverride(
            r.branchPatternOverrides,
            stageId,
            pattern,
          ),
        }
      : r,
  ),
});

/** A row group's branch-pattern override for a stage. */
export const setRowGroupOverride = (
  d: Dashboard,
  groupId: string,
  stageId: string,
  pattern: string,
): Dashboard =>
  updateRowGroup(d, groupId, (g) => ({
    ...g,
    branchPatternOverrides: withOverride(
      g.branchPatternOverrides,
      stageId,
      pattern,
    ),
  }));

/** A row group's default credential of one kind (unset with `undefined`). */
export const setRowGroupCredential = (
  d: Dashboard,
  groupId: string,
  kind: CredentialKind,
  credentialId: string | undefined,
): Dashboard =>
  updateRowGroup(d, groupId, (g) => ({
    ...g,
    defaultCredentials: { ...g.defaultCredentials, [kind]: credentialId },
  }));

/** Does a row group carry settings that are lost when it disappears? */
export const carriesSettings = (g: RowGroup): boolean =>
  Object.keys(g.branchPatternOverrides).length > 0 ||
  Boolean(g.defaultCredentials.github ?? g.defaultCredentials.aws);
