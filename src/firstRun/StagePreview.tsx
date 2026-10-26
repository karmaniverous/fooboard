/**
 * The stages the stages step would create (spec.md §3.9): each stage's
 * name, its branch pattern and how many of the chosen repos have a branch
 * matching it, so a stage matching nothing shows before the board does.
 *
 * @module
 */
import type { Stage } from '@/domain/config/stage';
import { branchOf } from '@/domain/rules/branch';
import { patternPreview } from '@/editors/branches';

export function StagePreview({
  stages,
  byRepo,
}: {
  stages: readonly Stage[];
  byRepo: ReadonlyMap<string, readonly string[]>;
}): React.JSX.Element | null {
  if (stages.length === 0) return null;
  return (
    <ul aria-label="Stages" className="flex flex-col gap-1 text-sm">
      {stages.map((stage) => {
        const pattern = branchOf(stage.rules.github) ?? '';
        const repos = patternPreview(pattern, byRepo).repos.length;
        return (
          <li key={stage.id} className="flex flex-wrap gap-x-2">
            <span className="font-medium">{stage.name}</span>
            <code className="text-muted-foreground">{pattern}</code>
            <span className="text-muted-foreground">
              {repos === 0
                ? 'no branch matches yet'
                : `in ${String(repos)} of ${String(byRepo.size)} repos`}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
