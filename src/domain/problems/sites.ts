/**
 * Every placement and status rule in a dashboard (spec.md A§4.3.7), with
 * where it lives (the level a problem with it is marked on), the item the
 * editor opens on, the source it is for, and what `$` is for it. Status
 * sets are the dashboard's own and every preset in use. Pure.
 *
 * @module
 */
import type { Dashboard } from '@/domain/config/dashboard';
import {
  type Provider,
  PROVIDER_LABELS,
  PROVIDERS,
} from '@/domain/config/providers';
import type { NamedKey } from '@/domain/rules/pathKeys';
import type { Rule } from '@/domain/rules/schema';
import { heldSettings, type SettingsPlace } from '@/domain/settings/places';
import { rowsUnder } from '@/domain/settings/reads';
import { PRESETS } from '@/domain/statuses/presets';
import { statusSetFor } from '@/domain/statuses/resolve';

import { type EditTarget, levelOfPlace, type ProblemLevel } from './problem';

export interface RuleSite {
  level: ProblemLevel;
  target: EditTarget;
  what: string;
  provider: Provider;
  rule: Rule | undefined;
  /** What `$` is for the rule. */
  scope: NamedKey['scope'];
  /** Keyed by source at a level several sources share: the rows that
   * level reaches (every row for the dashboard and columns). */
  sharedBy?: readonly string[];
}

/** The status sets `d` uses or owns, each once. */
function statusSets(d: Dashboard) {
  const used = d.rows.flatMap((row) =>
    d.stages.map((s) => statusSetFor(d, row, s.id)),
  );
  const presets = PRESETS.filter((p) => used.some((u) => u.id === p.id));
  return [...presets, ...d.customStatusSets];
}

/** The rows a settings place reaches, when it is shared by sources: a
 * row or a cell is its row's own. */
const reached = (d: Dashboard, place: SettingsPlace): string[] | undefined =>
  place.level === 'row' || place.level === 'cell'
    ? undefined
    : rowsUnder(d, place).map((r) => r.id);

/** The item rules set at every level (spec.md §3.11). */
const itemRuleSites = (d: Dashboard): RuleSite[] =>
  heldSettings(d).flatMap(({ place, settings }) =>
    PROVIDERS.flatMap((p): RuleSite[] => {
      const rule = settings.itemRules?.[p];
      if (rule === undefined) return [];
      const sharedBy = reached(d, place);
      return [
        {
          level: levelOfPlace(place),
          target: { kind: 'settings', place, field: 'itemRules', source: p },
          what: sharedBy ? `${PROVIDER_LABELS[p]} item rule` : 'item rule',
          provider: p,
          rule,
          scope: 'item',
          ...(sharedBy ? { sharedBy } : {}),
        },
      ];
    }),
  );

/** Every placement and status rule in `d`. */
export function ruleSites(d: Dashboard): RuleSite[] {
  const sites: RuleSite[] = [];
  const all = d.rows.map((r) => r.id);
  const dash: ProblemLevel = { kind: 'dashboard' };
  for (const p of PROVIDERS) {
    const label = PROVIDER_LABELS[p];
    const shared = (
      level: ProblemLevel,
      target: EditTarget,
      what: string,
      rule: Rule | undefined,
      scope: NamedKey['scope'],
      sharedBy: readonly string[] = all,
    ) => {
      sites.push({
        level,
        target,
        what: `${label} ${what}`,
        provider: p,
        rule,
        scope,
        sharedBy,
      });
    };
    shared(
      dash,
      { kind: 'dashboard', part: 'stageRules' },
      'stage rule',
      d.stageRules[p],
      'record',
    );
    shared(
      dash,
      { kind: 'dashboard', part: 'rowRules' },
      'row rule',
      d.rowRules[p]?.record,
      'record',
    );
    for (const g of d.columnGroups) {
      const level = { kind: 'columnGroup', id: g.id } as const;
      shared(level, level, 'stage rule', g.stageRules[p], 'record');
    }
    for (const s of d.stages) {
      const level = { kind: 'stage', id: s.id } as const;
      shared(level, level, 'stage rule', s.rules[p], 'record');
    }
    for (const g of d.rowGroups) {
      const level = { kind: 'rowGroup', id: g.id } as const;
      const members = g.memberIds;
      shared(
        level,
        { ...level, part: 'record' },
        'row rule',
        g.rowRules[p]?.record,
        'record',
        members,
      );
      for (const [stageId, rules] of Object.entries(g.stageRules))
        shared(
          level,
          { ...level, stageId },
          `stage rule for ${stageId}`,
          rules[p],
          'record',
          members,
        );
    }
  }
  for (const row of d.rows) {
    const level = { kind: 'row', id: row.id } as const;
    const p = row.type;
    sites.push(
      {
        level,
        target: { ...level, part: 'record' },
        what: 'row rule',
        provider: p,
        rule: row.recordRule,
        scope: 'record',
      },
      ...Object.entries(row.stageRules).map(([stageId, rule]) => ({
        level,
        target: { ...level, stageId },
        what: `stage rule for ${stageId}`,
        provider: p,
        rule,
        scope: 'record' as const,
      })),
    );
  }
  sites.push(...itemRuleSites(d));
  for (const set of statusSets(d)) {
    const level = { kind: 'statusSet', id: set.id } as const;
    const owned = d.customStatusSets.includes(set);
    const sharedBy = owned ? all : undefined;
    sites.push({
      level,
      target: level,
      what: `${set.name} item rule`,
      provider: set.provider,
      rule: set.items,
      scope: 'item',
      sharedBy,
    });
    for (const c of set.cell)
      sites.push({
        level,
        target: level,
        what: `${set.name}: ${c.name} rule`,
        provider: set.provider,
        rule: c.rule,
        scope: 'record',
        sharedBy,
      });
  }
  return sites;
}
