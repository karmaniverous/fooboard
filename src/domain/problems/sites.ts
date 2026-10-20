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
import { PRESETS } from '@/domain/statuses/presets';
import { statusSetFor } from '@/domain/statuses/resolve';

import type { EditTarget, ProblemLevel } from './problem';

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
    [undefined, ...d.stages.map((s) => s.id)].map((stageId) =>
      statusSetFor(d, row, stageId),
    ),
  );
  const presets = PRESETS.filter((p) => used.some((u) => u.id === p.id));
  return [...presets, ...d.customStatusSets];
}

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
    shared(
      dash,
      { kind: 'dashboard', part: 'itemRules' },
      'item rule',
      d.rowRules[p]?.items,
      'item',
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
      shared(
        level,
        { ...level, part: 'items' },
        'item rule',
        g.rowRules[p]?.items,
        'item',
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
      {
        level,
        target: { ...level, part: 'items' },
        what: 'item rule',
        provider: p,
        rule: row.itemRule,
        scope: 'item',
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
