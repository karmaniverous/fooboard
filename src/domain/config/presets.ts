/**
 * Branch presets (spec.md §3 table): create stages and branch patterns in
 * one step, editable afterwards. `createDashboard` builds a blank or
 * preset-seeded dashboard with defaults applied.
 *
 * @module
 */
import { type Dashboard, DashboardSchema } from './dashboard';
import type { Stage } from './stage';

/** Branch preset ids (spec.md §3 table). */
export type BranchPresetId =
  'env-branches' | 'gitflow-ish' | 'previews-release-train' | 'custom';

/** Options for presets that need input at setup (spec.md §3). */
export interface PresetOptions {
  /** Preview names, for `previews-release-train` (one stage each). */
  previewNames?: readonly string[];
}

function nextStageId(): string {
  return crypto.randomUUID();
}

/** Build the stages for a branch preset (spec.md §3 table). */
export function buildPresetStages(
  presetId: BranchPresetId,
  options: PresetOptions = {},
): Stage[] {
  switch (presetId) {
    case 'env-branches': {
      const dev: Stage = {
        id: nextStageId(),
        name: 'dev',
        branchPattern: 'dev',
      };
      const staging: Stage = {
        id: nextStageId(),
        name: 'staging',
        branchPattern: 'staging',
        sourceStageId: dev.id,
      };
      const prod: Stage = {
        id: nextStageId(),
        name: 'prod',
        branchPattern: 'main',
        sourceStageId: staging.id,
      };
      return [dev, staging, prod];
    }
    case 'gitflow-ish': {
      const dev: Stage = {
        id: nextStageId(),
        name: 'dev',
        branchPattern: 'develop',
      };
      const test: Stage = {
        id: nextStageId(),
        name: 'test',
        branchPattern: 'release/**',
        sourceStageId: dev.id,
      };
      const prod: Stage = {
        id: nextStageId(),
        name: 'prod',
        branchPattern: 'main',
        sourceStageId: test.id,
      };
      return [dev, test, prod];
    }
    case 'previews-release-train': {
      const dev: Stage = {
        id: nextStageId(),
        name: 'dev',
        branchPattern: 'dev',
      };
      const previews: Stage[] = (options.previewNames ?? []).map((name) => ({
        id: nextStageId(),
        name,
        branchPattern: `preview/${name}`,
        sourceStageId: dev.id,
      }));
      const release: Stage = {
        id: nextStageId(),
        name: 'release',
        branchPattern: 'release/**',
        sourceStageId: dev.id,
      };
      const prod: Stage = {
        id: nextStageId(),
        name: 'prod',
        branchPattern: 'main',
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
