/**
 * Rule problems (spec.md A§4.3.7 *Rule problems*): reported, never thrown,
 * at the level that causes them, so the board can mark that spot. This
 * module finds the problems a configuration has on its own: paths that
 * don't parse, stages no stage rule covers, rules naming keys their source
 * rule doesn't produce, item rules on a source without items, and Amplify
 * rows without a GitHub credential (no badges; dismissable). Pure.
 *
 * @module
 */
import type { Dashboard } from '@/domain/config/dashboard';
import { rowGithubCredentialId } from '@/domain/config/inheritance';
import { ownOverride } from '@/domain/config/ownOverride';
import type { Row } from '@/domain/config/row';
import { PROVIDER_LABELS, STATUS_PROVIDERS } from '@/domain/config/statusSets';
import type { SourceRule } from '@/domain/model/sourceRule';
import { sourceRuleFor } from '@/domain/model/sources';
import { ruleProblems } from '@/domain/rules/check';
import { type NamedKey, pathKeys } from '@/domain/rules/pathKeys';
import type { Rule } from '@/domain/rules/schema';

type Provider = Row['type'];

/** Where a problem is marked. */
export type ProblemLevel =
  | { kind: 'dashboard' }
  | { kind: 'rowGroup'; id: string }
  | { kind: 'row'; id: string }
  | { kind: 'columnGroup'; id: string }
  | { kind: 'stage'; id: string }
  | { kind: 'cell'; rowId: string; stageId: string };

export interface Problem {
  /** Stable while the problem is the same (for dismissals). */
  id: string;
  level: ProblemLevel;
  message: string;
  dismissable: boolean;
}

const levelKey = (l: ProblemLevel): string =>
  l.kind === 'dashboard'
    ? 'dashboard'
    : l.kind === 'cell'
      ? `cell:${l.rowId}:${l.stageId}`
      : `${l.kind}:${l.id}`;

/** A problem at `level`. */
export const problem = (
  level: ProblemLevel,
  message: string,
  dismissable = false,
): Problem => ({
  id: `${levelKey(level)}|${message}`,
  level,
  message,
  dismissable,
});

/** The keys a source rule's records and items have. */
function producedKeys(source: SourceRule): Set<string> {
  const keys = new Set(source.keys.map((k) => `record:${k.name}`));
  keys.add('record:_raw');
  if (source.items) {
    keys.add('record:items');
    for (const k of source.items.keys) keys.add(`item:${k.name}`);
  }
  return keys;
}

interface RuleSite {
  level: ProblemLevel;
  what: string;
  provider: Provider;
  rule: Rule | undefined;
  /** What `$` is for the rule. */
  scope: NamedKey['scope'];
}

/** Every placement and status rule in `d`, with where it lives. */
function ruleSites(d: Dashboard): RuleSite[] {
  const sites: RuleSite[] = [];
  const dash: ProblemLevel = { kind: 'dashboard' };
  for (const p of STATUS_PROVIDERS) {
    const label = PROVIDER_LABELS[p];
    sites.push(
      {
        level: dash,
        what: `${label} stage rule`,
        provider: p,
        rule: d.stageRules[p],
        scope: 'record',
      },
      {
        level: dash,
        what: `${label} row rule`,
        provider: p,
        rule: d.rowRules[p]?.record,
        scope: 'record',
      },
      {
        level: dash,
        what: `${label} item rule`,
        provider: p,
        rule: d.rowRules[p]?.items,
        scope: 'item',
      },
    );
    for (const g of d.columnGroups)
      sites.push({
        level: { kind: 'columnGroup', id: g.id },
        what: `${label} stage rule`,
        provider: p,
        rule: g.stageRules[p],
        scope: 'record',
      });
    for (const s of d.stages)
      sites.push({
        level: { kind: 'stage', id: s.id },
        what: `${label} stage rule`,
        provider: p,
        rule: s.rules[p],
        scope: 'record',
      });
    for (const g of d.rowGroups) {
      const level: ProblemLevel = { kind: 'rowGroup', id: g.id };
      sites.push(
        {
          level,
          what: `${label} row rule`,
          provider: p,
          rule: g.rowRules[p]?.record,
          scope: 'record',
        },
        {
          level,
          what: `${label} item rule`,
          provider: p,
          rule: g.rowRules[p]?.items,
          scope: 'item',
        },
        ...Object.entries(g.stageRules).map(([stageId, rules]) => ({
          level,
          what: `${label} stage rule for ${stageId}`,
          provider: p,
          rule: rules[p],
          scope: 'record' as const,
        })),
      );
    }
  }
  for (const row of d.rows) {
    const level: ProblemLevel = { kind: 'row', id: row.id };
    const p = row.type;
    sites.push(
      {
        level,
        what: 'row rule',
        provider: p,
        rule: row.recordRule,
        scope: 'record',
      },
      {
        level,
        what: 'item rule',
        provider: p,
        rule: row.itemRule,
        scope: 'item',
      },
      ...Object.entries(row.stageRules).map(([stageId, rule]) => ({
        level,
        what: `stage rule for ${stageId}`,
        provider: p,
        rule,
        scope: 'record' as const,
      })),
    );
  }
  for (const set of d.customStatusSets) {
    sites.push({
      level: dash,
      what: `${set.name} item rule`,
      provider: set.provider,
      rule: set.items,
      scope: 'item',
    });
    for (const c of set.cell)
      sites.push({
        level: dash,
        what: `${set.name}: ${c.name} rule`,
        provider: set.provider,
        rule: c.rule,
        scope: 'record',
      });
  }
  return sites;
}

/** Problems with one rule: checks that can't run, keys its source rule
 * doesn't produce, item rules where there are no items. */
function siteProblems(site: RuleSite, source: SourceRule): Problem[] {
  const { rule } = site;
  if (!rule || rule.checks.length === 0) return [];
  const out = ruleProblems(rule).map((m) =>
    problem(site.level, `${site.what}: ${m}`),
  );
  if (site.scope === 'item' && !source.items)
    return [
      ...out,
      problem(site.level, `${site.what}: ${source.name} records have no items`),
    ];
  const produced = producedKeys(source);
  const missing = new Set(
    rule.checks
      .flatMap((c) => pathKeys(c.path, site.scope) ?? [])
      .filter((k) => !produced.has(`${k.scope}:${k.name}`))
      .map((k) => `${k.scope === 'item' ? 'item key' : 'key'} ${k.name}`),
  );
  return [
    ...out,
    ...[...missing].map((m) =>
      problem(site.level, `${site.what}: ${source.name} gives no ${m}`),
    ),
  ];
}

/** Stages that some row of a source can't place anything in, because no
 * level gives them a stage rule for that source. */
function uncoveredStages(d: Dashboard): Problem[] {
  return d.stages.flatMap((s) =>
    STATUS_PROVIDERS.filter((p) => {
      const shared =
        s.rules[p] ??
        d.columnGroups.find((g) => g.memberIds.includes(s.id))?.stageRules[p] ??
        d.stageRules[p];
      if (shared) return false;
      return d.rows.some((row) => {
        if (row.type !== p) return false;
        const group = d.rowGroups.find((g) => g.memberIds.includes(row.id));
        return (
          ownOverride(row.stageRules, s.id) === undefined &&
          (group ? ownOverride(group.stageRules, s.id)?.[p] : undefined) ===
            undefined
        );
      });
    }).map((p) =>
      problem(
        { kind: 'stage', id: s.id },
        `no ${PROVIDER_LABELS[p]} stage rule: its ${PROVIDER_LABELS[p]} cells match nothing`,
      ),
    ),
  );
}

/** Every problem `d` has on its own. */
export function configProblems(d: Dashboard): Problem[] {
  const sources = {
    github: sourceRuleFor(d, 'github'),
    amplify: sourceRuleFor(d, 'amplify'),
  };
  const sourceSites = Object.values(sources).flatMap((source) =>
    [
      ...source.keys.flatMap((k) => k.translations.map((t) => t.rule)),
      ...(source.items?.keys ?? []).flatMap((k) =>
        k.translations.map((t) => t.rule),
      ),
      source.keep,
    ].flatMap((rule) =>
      ruleProblems(rule).map((m) =>
        problem({ kind: 'dashboard' }, `${source.name} source rule: ${m}`),
      ),
    ),
  );
  const badges = d.rows
    .filter((row) => row.type === 'amplify' && !rowGithubCredentialId(d, row))
    .map((row) =>
      problem(
        { kind: 'row', id: row.id },
        'no GitHub credential, so no behind or diverged badges',
        true,
      ),
    );
  return [
    ...sourceSites,
    ...ruleSites(d).flatMap((site) =>
      siteProblems(site, sources[site.provider]),
    ),
    ...uncoveredStages(d),
    ...badges,
  ];
}
