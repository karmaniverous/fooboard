/**
 * What a row inherits, most specific first: the row, then its row group,
 * then the dashboard: default credentials (C-1a), and the override lookup
 * placement rules share (stage rules: `placement.ts`). Pure.
 *
 * @module
 */
import { type DefaultCredentials, resolveCredentialId } from './credentialRefs';
import type { CredentialKind } from './credentials';
import { groupOf, type RowGroup } from './groups';
import type { Row } from './row';

/** The dashboard fields inheritance reads. */
interface Levels {
  defaultCredentials: DefaultCredentials;
  rowGroups: readonly RowGroup[];
}

/** The default credentials a row inherits: its group's, else the
 * dashboard's, per kind. */
export function inheritedCredentials(
  dashboard: Levels,
  rowId: string,
): DefaultCredentials {
  const group = groupOf(dashboard.rowGroups, rowId)?.defaultCredentials;
  const own = dashboard.defaultCredentials;
  return { github: group?.github ?? own.github, aws: group?.aws ?? own.aws };
}

/** What a row's unset credential of `kind` resolves to, and where it
 * comes from: its group's default if set, else the dashboard's. */
export function inheritedCredential(
  dashboard: Levels,
  rowId: string,
  kind: CredentialKind,
): { from: 'group' | 'dashboard'; id?: string } {
  const group = groupOf(dashboard.rowGroups, rowId)?.defaultCredentials[kind];
  return group
    ? { from: 'group', id: group }
    : { from: 'dashboard', id: dashboard.defaultCredentials[kind] };
}
/** The GitHub token a row reads with: its own, else the inherited one. */
export function rowGithubCredentialId(
  dashboard: Levels,
  row: Row,
): string | undefined {
  return resolveCredentialId(
    inheritedCredentials(dashboard, row.id),
    'github',
    row.type === 'github' ? row.credentialId : row.githubCredentialId,
  );
}
