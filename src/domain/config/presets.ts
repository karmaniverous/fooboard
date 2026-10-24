/**
 * Branch presets (spec.md §3 table): create stages and branch patterns in
 * one step, editable afterwards. `createDashboard` builds a blank or
 * preset-seeded dashboard with defaults applied.
 *
 * @module
 */
import { z } from 'zod';

import { type Dashboard, DashboardSchema } from './dashboard';
import { branchRules } from './placement';
import type { Stage } from './stage';

/** Branch preset ids (spec.md §3 table). */
export const BranchPresetIdSchema = z.enum([
  'env-branches',
  'gitflow-ish',
  'previews-release-train',
  'custom',
]);
export type BranchPresetId = z.infer<typeof BranchPresetIdSchema>;

/** Options for presets that need input at setup (spec.md §3). */
export const PresetOptionsSchema = z.object({
  /** Preview names, for `previews-release-train` (one stage each). */
  previewNames: z.array(z.string().trim().min(1)).optional(),
});
export type PresetOptions = z.input<typeof PresetOptionsSchema>;

function nextStageId(): string {
  return crypto.randomUUID();
}

/** Build the stages for a branch preset (spec.md §3 table). Inputs are
 * validated here, since they come from the UI or an import. */
export function buildPresetStages(
  presetIdInput: BranchPresetId,
  optionsInput: PresetOptions = {},
): Stage[] {
  const presetId = BranchPresetIdSchema.parse(presetIdInput);
  const options = PresetOptionsSchema.parse(optionsInput);
  switch (presetId) {
    case 'env-branches': {
      const dev: Stage = {
        id: nextStageId(),
        name: 'dev',
        rules: branchRules('dev'),
        settings: {},
      };
      const staging: Stage = {
        id: nextStageId(),
        name: 'staging',
        rules: branchRules('staging'),
        settings: {},
        sourceStageId: dev.id,
      };
      const prod: Stage = {
        id: nextStageId(),
        name: 'prod',
        rules: branchRules('main'),
        settings: {},
        sourceStageId: staging.id,
      };
      return [dev, staging, prod];
    }
    case 'gitflow-ish': {
      const dev: Stage = {
        id: nextStageId(),
        name: 'dev',
        rules: branchRules('develop'),
        settings: {},
      };
      const test: Stage = {
        id: nextStageId(),
        name: 'test',
        rules: branchRules('release/**'),
        settings: {},
        sourceStageId: dev.id,
      };
      const prod: Stage = {
        id: nextStageId(),
        name: 'prod',
        rules: branchRules('main'),
        settings: {},
        sourceStageId: test.id,
      };
      return [dev, test, prod];
    }
    case 'previews-release-train': {
      const dev: Stage = {
        id: nextStageId(),
        name: 'dev',
        rules: branchRules('dev'),
        settings: {},
      };
      const previews: Stage[] = (options.previewNames ?? []).map((name) => ({
        id: nextStageId(),
        name,
        rules: branchRules(`preview/${name}`),
        settings: {},
        sourceStageId: dev.id,
      }));
      const release: Stage = {
        id: nextStageId(),
        name: 'release',
        rules: branchRules('release/**'),
        settings: {},
        sourceStageId: dev.id,
      };
      const prod: Stage = {
        id: nextStageId(),
        name: 'prod',
        rules: branchRules('main'),
        settings: {},
        sourceStageId: release.id,
      };
      return [dev, ...previews, release, prod];
    }
    case 'custom':
      return [];
  }
}

function nextDashboardId(): string {
  return crypto.randomUUID();
}

/**
 * Create a new dashboard (spec.md C-21: blank, from a preset, or by
 * duplicating elsewhere) with all mapping, color and credential defaults
 * applied, and stages from `presetId` if given.
 */
export function createDashboard(
  name: string,
  presetId: BranchPresetId = 'custom',
  options: PresetOptions = {},
): Dashboard {
  return DashboardSchema.parse({
    id: nextDashboardId(),
    name,
    stages: buildPresetStages(presetId, options),
  });
}
