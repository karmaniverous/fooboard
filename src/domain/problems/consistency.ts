/**
 * The consistency check (spec.md A§4.3.7 *Consistency between the three
 * kinds*): each placement and status rule against the keys its source
 * rule produces, walking each path segment by segment, filters included.
 * Problems: checks that can't run, keys the source rule doesn't produce
 * (paths under `_raw` excepted), paths going inside a key that only ever
 * holds text, item rules for a source without items. Notes (not marked
 * on the board): what can't be decided ("unchecked"), and rules keyed by
 * a source no row uses. Pure.
 *
 * @module
 */
import type { Row } from '@/domain/config/row';
import { PROVIDER_LABELS } from '@/domain/config/statusSets';
import type { KeyDef, SourceRule } from '@/domain/model/sourceRule';
import { ruleProblems } from '@/domain/rules/check';
import { type NamedKey, pathRefs } from '@/domain/rules/pathKeys';

import { note, type Problem, problem } from './problem';
import type { RuleSite } from './sites';

/** A source rule's record and item keys, by scope and name. */
function producedKeys(source: SourceRule): Map<string, KeyDef | undefined> {
  const keys = new Map<string, KeyDef | undefined>(
    source.keys.map((k) => [`record:${k.name}`, k]),
  );
  keys.set('record:_raw', undefined);
  if (source.items) {
    keys.set('record:items', undefined);
    for (const k of source.items.keys) keys.set(`item:${k.name}`, k);
  }
  return keys;
}

const keyText = (k: NamedKey) =>
  `${k.scope === 'item' ? 'item key' : 'key'} ${k.name}`;

/** Does some translation of `key` copy its value (so what is inside it is
 * not known)? */
const copies = (key: KeyDef | undefined): boolean =>
  key === undefined || key.translations.some((t) => 'copy' in t);

/** Problems and notes for one rule. */
export function siteProblems(site: RuleSite, source: SourceRule): Problem[] {
  const { rule, level, target, what } = site;
  if (!rule || rule.checks.length === 0) return [];
  const at = (message: string) =>
    problem(level, `${what}: ${message}`, false, { target });
  const out = ruleProblems(rule).map(at);
  if (site.scope === 'item' && !source.items)
    return [...out, at(`${source.name} records have no items`)];
  const produced = producedKeys(source);
  const missing = new Set<string>();
  const textOnly = new Set<string>();
  const unchecked = new Set<string>();
  for (const check of rule.checks) {
    const refs = pathRefs(check.path, site.scope);
    if (!refs) continue;
    for (const k of refs.keys)
      if (!produced.has(`${k.scope}:${k.name}`)) missing.add(keyText(k));
    for (const k of refs.inside) {
      const id = `${k.scope}:${k.name}`;
      if (!produced.has(id)) continue;
      if (copies(produced.get(id)))
        unchecked.add(`${check.path} (inside copied ${keyText(k)})`);
      else textOnly.add(keyText(k));
    }
    for (const reason of refs.unchecked)
      unchecked.add(`${check.path} (${reason})`);
  }
  return [
    ...out,
    ...[...missing].map((m) => at(`${source.name} gives no ${m}`)),
    ...[...textOnly].map((m) =>
      at(`${source.name}'s ${m} is always text, so nothing is inside it`),
    ),
    ...[...unchecked].map((u) =>
      note(level, `${what}: unchecked ${u}`, target),
    ),
  ];
}

const PLACES_LISTED = 5;

/** Where a site is, briefly. */
const placeOf = (site: RuleSite): string => {
  const { level } = site;
  switch (level.kind) {
    case 'dashboard':
      return 'the dashboard';
    case 'statusSet':
      return `set ${level.id}`;
    case 'rowGroup':
      return `row group ${level.id}`;
    case 'columnGroup':
      return `column group ${level.id}`;
    case 'stage':
      return `stage ${level.id}`;
    case 'row':
      return `row ${level.id}`;
    case 'cell':
      return `${level.rowId} / ${level.stageId}`;
  }
};

/** One note per source for rules keyed by it where none of the rows they
 * reach read it (informational: the branch presets write a rule for
 * every source, so a board with one source has many). */
export function unusedSourceNotes(
  sites: readonly RuleSite[],
  rows: readonly Pick<Row, 'id' | 'type'>[],
): Problem[] {
  const unused = sites.filter(
    ({ rule, sharedBy, provider }) =>
      rule !== undefined &&
      rule.checks.length > 0 &&
      sharedBy !== undefined &&
      !rows.some((r) => r.type === provider && sharedBy.includes(r.id)),
  );
  return (['github', 'amplify'] as const).flatMap((p) => {
    const places = [
      ...new Set(unused.filter((s) => s.provider === p).map(placeOf)),
    ];
    if (places.length === 0) return [];
    const label = PROVIDER_LABELS[p];
    const listed = places.slice(0, PLACES_LISTED).join(', ');
    const more = places.length > PLACES_LISTED ? ', ...' : '';
    return [
      note(
        { kind: 'dashboard' },
        `${label} rules where no row reads ${label}, so unused: ${listed}${more}`,
      ),
    ];
  });
}
