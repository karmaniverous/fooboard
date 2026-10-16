/**
 * Source-stage cycle detection (spec.md §8 step 1, used by the stage
 * editor's source picker in spec.md C-21 to reject cycles). Pure graph
 * walk over `sourceStageId` links.
 *
 * @module
 */
import type { Stage } from './stage';

/**
 * Return the ids of a cycle reachable from `startId` by following
 * `sourceStageId` links, or `undefined` if the source-stage graph rooted at
 * `startId` is acyclic.
 */
export function findSourceCycle(
  stages: readonly Pick<Stage, 'id' | 'sourceStageId'>[],
  startId: string,
): string[] | undefined {
  const byId = new Map(stages.map((s) => [s.id, s]));
  const path: string[] = [];
  const seen = new Set<string>();
  let currentId: string | undefined = startId;

  while (currentId !== undefined) {
    if (seen.has(currentId)) {
      const cycleStart = path.indexOf(currentId);
      return path.slice(cycleStart);
    }
    seen.add(currentId);
    path.push(currentId);
    currentId = byId.get(currentId)?.sourceStageId;
  }
  return undefined;
}

/**
 * Would setting `stageId`'s source to `candidateSourceId` create a cycle?
 * Used by the stage editor to reject an invalid source choice before it is
 * saved (spec.md C-21).
 */
export function wouldCreateCycle(
  stages: readonly Pick<Stage, 'id' | 'sourceStageId'>[],
  stageId: string,
  candidateSourceId: string,
): boolean {
  if (stageId === candidateSourceId) return true;
  const proposed = stages.map((s) =>
    s.id === stageId ? { ...s, sourceStageId: candidateSourceId } : s,
  );
  return findSourceCycle(proposed, stageId) !== undefined;
}

/** Return every stage id involved in a source-stage cycle, if any. */
export function findAnyCycle(
  stages: readonly Pick<Stage, 'id' | 'sourceStageId'>[],
): string[] | undefined {
  for (const stage of stages) {
    const cycle = findSourceCycle(stages, stage.id);
    if (cycle) return cycle;
  }
  return undefined;
}
