/**
 * A column header's tooltip: the stage name and, when its rule is a plain
 * branch rule, the branch pattern (spec.md A§4.3.7). Pure.
 *
 * @module
 */
import type { Stage } from '@/domain/config/stage';
import { branchOf } from '@/domain/rules/branch';

export function stageLabel(stage: Pick<Stage, 'name' | 'rules'>): string {
  const github = branchOf(stage.rules.github);
  const amplify = branchOf(stage.rules.amplify);
  const pattern =
    github !== undefined && (amplify === undefined || amplify === github)
      ? github
      : amplify;
  return pattern === undefined ? stage.name : `${stage.name} (${pattern})`;
}
