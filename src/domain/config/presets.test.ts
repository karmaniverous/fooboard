/**
 * Tests for branch presets and `createDashboard` (spec.md §3 table).
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { branchOf } from '@/domain/rules/branch';

import { buildPresetStages, createDashboard } from './presets';

describe('buildPresetStages', () => {
  it('builds the env-branches chain dev -> staging -> prod', () => {
    const stages = buildPresetStages('env-branches');
    expect(stages.map((s) => [s.name, branchOf(s.rules.github)])).toEqual([
      ['dev', 'dev'],
      ['staging', 'staging'],
      ['prod', 'main'],
    ]);
    const dev = stages[0];
    const staging = stages[1];
    const prod = stages[2];
    expect(staging.sourceStageId).toBe(dev.id);
    expect(prod.sourceStageId).toBe(staging.id);
  });

  it('builds the gitflow-ish chain dev -> test -> prod', () => {
    const stages = buildPresetStages('gitflow-ish');
    expect(stages.map((s) => [s.name, branchOf(s.rules.github)])).toEqual([
      ['dev', 'develop'],
      ['test', 'release/**'],
      ['prod', 'main'],
    ]);
    expect(stages[1].sourceStageId).toBe(stages[0].id);
    expect(stages[2].sourceStageId).toBe(stages[1].id);
  });

  it('builds previews + release train with preview names sourced from dev', () => {
    const stages = buildPresetStages('previews-release-train', {
      previewNames: ['bali', 'cusco'],
    });
    const names = stages.map((s) => s.name);
    expect(names).toEqual(['dev', 'bali', 'cusco', 'release', 'prod']);
    const dev = stages[0];
    const bali = stages.find((s) => s.name === 'bali');
    const release = stages.find((s) => s.name === 'release');
    const prod = stages.find((s) => s.name === 'prod');
    expect(branchOf(bali?.rules.amplify)).toBe('preview/bali');
    expect(bali?.sourceStageId).toBe(dev.id);
    expect(release?.sourceStageId).toBe(dev.id);
    expect(prod?.sourceStageId).toBe(release?.id);
  });

  it('returns no stages for custom', () => {
    expect(buildPresetStages('custom')).toEqual([]);
  });

  it('rejects an unknown preset id', () => {
    expect(() => {
      Reflect.apply(buildPresetStages, undefined, ['nope']);
    }).toThrow();
  });

  it('rejects a blank preview name', () => {
    expect(() =>
      buildPresetStages('previews-release-train', { previewNames: [' '] }),
    ).toThrow();
  });
});

describe('createDashboard', () => {
  it('creates a blank dashboard with no stages by default', () => {
    const dashboard = createDashboard('My board');
    expect(dashboard.name).toBe('My board');
    expect(dashboard.stages).toEqual([]);
    expect(dashboard.id).toBeTruthy();
  });

  it('creates a dashboard seeded from a preset', () => {
    const dashboard = createDashboard('My board', 'env-branches');
    expect(dashboard.stages).toHaveLength(3);
  });

  it('generates distinct ids for each dashboard', () => {
    const a = createDashboard('A');
    const b = createDashboard('B');
    expect(a.id).not.toBe(b.id);
  });
});
