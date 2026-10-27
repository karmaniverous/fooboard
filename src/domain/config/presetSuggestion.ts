/**
 * The first run's stage suggestion (spec.md §3.9, C-22, Decision 16):
 * the branch preset that best fits the branches found in the chosen
 * repos, and the preview stages named from their `preview/*` branches.
 *
 * A preset's fit is how many repos have a branch matching each of its
 * stage patterns, summed over its stages; the release train also counts
 * the repos with a preview branch it would name. Ties go to the preset
 * leaving fewer stages that match nothing, then to the order presets are
 * listed in. When nothing matches, the suggestion is a blank dashboard.
 * Pure.
 *
 * @module
 */
import { unique } from 'radash';

import { matchesBranchPattern } from '@/domain/matching';
import { branchOf } from '@/domain/rules/branch';

import { type BranchPresetId, buildPresetStages } from './presets';

/** The preset that names preview stages. */
export const PREVIEW_PRESET = 'previews-release-train' satisfies BranchPresetId;

/** What a preview branch starts with; the rest, one segment, names it. */
const PREVIEW_PREFIX = 'preview/';

/** The presets a suggestion chooses from, in the order ties go. */
const SUGGESTED: readonly BranchPresetId[] = [
  'env-branches',
  'gitflow-ish',
  PREVIEW_PRESET,
];

/** Branch names per repo, as `discoverBranches` finds them. */
export type BranchesByRepo = ReadonlyMap<string, readonly string[]>;

/** How many repos have a branch for which `test` holds. */
const reposWith = (
  byRepo: BranchesByRepo,
  test: (branch: string) => boolean,
): number => [...byRepo.values()].filter((names) => names.some(test)).length;

/** The preview name a branch gives, if it is `preview/<name>`. */
const previewName = (branch: string): string | undefined => {
  if (!branch.startsWith(PREVIEW_PREFIX)) return undefined;
  const name = branch.slice(PREVIEW_PREFIX.length);
  return name && !name.includes('/') ? name : undefined;
};

/** A preset's stages' names and branch patterns, from the preset itself. */
const presetStages = (presetId: BranchPresetId) =>
  buildPresetStages(presetId).map((stage) => ({
    name: stage.name,
    pattern: branchOf(stage.rules.github) ?? '',
  }));

/**
 * The preview stages `preview/*` branches name, most common first (then
 * by name). A name the release train already gives a stage (`release`,
 * as in `preview/release`) names no preview stage.
 */
export function previewNames(byRepo: BranchesByRepo): string[] {
  const taken = new Set(presetStages(PREVIEW_PRESET).map((s) => s.name));
  const counts = new Map<string, number>();
  for (const branches of byRepo.values()) {
    for (const name of unique(branches.flatMap((b) => previewName(b) ?? []))) {
      if (!taken.has(name)) counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }
  return [...counts]
    .sort(([a, m], [b, n]) => n - m || a.localeCompare(b))
    .map(([name]) => name);
}

/** The suggested preset, and the preview names found (offered with the
 * release train, whichever preset is suggested). */
export interface PresetSuggestion {
  presetId: BranchPresetId;
  previewNames: string[];
}

export function suggestPreset(byRepo: BranchesByRepo): PresetSuggestion {
  const previews = previewNames(byRepo);
  const named = new Set(previews);
  const scored = SUGGESTED.map((presetId, order) => {
    const hits = presetStages(presetId).map(({ pattern }) =>
      reposWith(byRepo, (b) => matchesBranchPattern(pattern, b)),
    );
    const previewHits =
      presetId === PREVIEW_PRESET
        ? reposWith(byRepo, (b) => named.has(previewName(b) ?? ''))
        : 0;
    return {
      presetId,
      order,
      score: hits.reduce((sum, n) => sum + n, previewHits),
      unmatched: hits.filter((n) => n === 0).length,
    };
  });
  const [best] = scored.sort(
    (a, b) =>
      b.score - a.score || a.unmatched - b.unmatched || a.order - b.order,
  );
  return {
    presetId: best.score > 0 ? best.presetId : 'custom',
    previewNames: previews,
  };
}
