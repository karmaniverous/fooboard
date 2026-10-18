/**
 * What a row inherits, most specific first: the row, then its row group,
 * then the stage or dashboard. Applies to branch patterns (spec.md C-14c),
 * used everywhere a pattern is (candidate runs, empty states, branch
 * discovery, staleness, Unmapped reasons), and to default credentials
 * (C-1a). Pure.
 *
 * @module
 */
import { type DefaultCredentials, resolveCredentialId } from './credentialRefs';
import type { CredentialKind } from './credentials';
import { groupOf, type RowGroup } from './groups';
import type { Row } from './row';
import type { Stage } from './stage';

/** The dashboard fields inheritance reads. */
interface Levels {
  defaultCredentials: DefaultCredentials;
  rowGroups: readonly RowGroup[];
}

/** The branch pattern `stage` resolves to for a row with `rowOverrides`
 * in `rowGroup`: row, then row group, then stage. */
export function effectiveBranchPattern(
  stage: Pick<Stage, 'id' | 'branchPattern'>,
  rowOverrides: Readonly<Partial<Record<string, string>>>,
  rowGroup: Pick<RowGroup, 'branchPatternOverrides'> | undefined,
): string {
  const groupOverrides: Readonly<Partial<Record<string, string>>> =
    rowGroup?.branchPatternOverrides ?? {};
  return (
    rowOverrides[stage.id] ?? groupOverrides[stage.id] ?? stage.branchPattern
  );
}

/** The dashboard's stages as `row` sees them: each with its effective
 * branch pattern. Unchanged stages are returned as they are. */
export function effectiveStages<S extends Stage>(
  dashboard: { stages: readonly S[]; rowGroups: readonly RowGroup[] },
  row: Pick<Row, 'id' | 'branchPatternOverrides'>,
): S[] {
  const group = groupOf(dashboard.rowGroups, row.id);
  return dashboard.stages.map((stage) => {
    const pattern = effectiveBranchPattern(
      stage,
      row.branchPatternOverrides,
      group,
    );
    return pattern === stage.branchPattern
      ? stage
      : { ...stage, branchPattern: pattern };
  });
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

/** Where a row's unset credential of kind comes from. */
export function inheritedFrom(
  dashboard: Levels,
  rowId: string,
  kind: CredentialKind,
): 'group' | 'dashboard' {
  return groupOf(dashboard.rowGroups, rowId)?.defaultCredentials[kind]
    ? 'group'
    : 'dashboard';
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
