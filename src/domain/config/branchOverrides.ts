/**
 * Effective branch-pattern resolution (spec.md C-14c): a stage's branch
 * pattern may be overridden for a row group or a row; the most specific
 * wins (row, then row group, then stage). Used everywhere a pattern is
 * (candidate runs, empty states, branch discovery, staleness, Unmapped
 * reasons). Pure.
 *
 * @module
 */
import { type RowGroup, rowGroupOf } from './groups';
import type { Row } from './row';
import type { Stage } from './stage';

/** The branch pattern `stage` resolves to for `row`, honouring row and
 * row-group overrides, most specific first. */
export function effectiveBranchPattern(
  stage: Pick<Stage, 'id' | 'branchPattern'>,
  row: Pick<Row, 'branchPatternOverrides'>,
  rowGroup: Pick<RowGroup, 'branchPatternOverrides'> | undefined,
): string {
  const pick = (
    overrides: Readonly<Partial<Record<string, string>>> | undefined,
  ) => overrides?.[stage.id];
  return (
    pick(row.branchPatternOverrides) ??
    pick(rowGroup?.branchPatternOverrides) ??
    stage.branchPattern
  );
}

/** The dashboard's stages as `row` sees them: each with its effective
 * branch pattern (C-14c). Unchanged stages are returned as they are. */
export function effectiveStages<S extends Stage>(
  dashboard: { stages: readonly S[]; rowGroups: readonly RowGroup[] },
  row: Pick<Row, 'id' | 'branchPatternOverrides'>,
): S[] {
  const group = rowGroupOf(dashboard.rowGroups, row.id);
  return dashboard.stages.map((stage) => {
    const pattern = effectiveBranchPattern(stage, row, group);
    return pattern === stage.branchPattern
      ? stage
      : { ...stage, branchPattern: pattern };
  });
}
