/**
 * Rule problems (spec.md A§4.3.7 *Rule problems*): reported, never thrown,
 * at the level that causes them, so the board can mark that spot. This
 * module gathers the problems a configuration has on its own: source
 * rules (A§4.3.7 *Three kinds*), references that don't resolve, the
 * consistency check over every placement and status rule, stages no stage
 * rule covers, Amplify rows without a GitHub repo or credential (no
 * badges; dismissable), and pinned apps under a key no cell of their row
 * reads with (a note, spec.md §3.12). Pure.
 *
 * @module
 */
import type { Dashboard } from '@/domain/config/dashboard';
import { ownOverride } from '@/domain/config/ownOverride';
import { PROVIDER_LABELS, PROVIDERS } from '@/domain/config/providers';
import type { Row } from '@/domain/config/row';
import { sourceRuleFor } from '@/domain/model/sources';
import { cellCredentials } from '@/domain/settings/credentials';
import { unusedPins } from '@/domain/settings/pins';

import { siteProblems, unusedSourceNotes } from './consistency';
import { note, type Problem, problem } from './problem';
import { referenceProblems } from './references';
import { ruleSites } from './sites';
import { sourceRuleProblems } from './sourceProblems';

/** Stages that some row of a source can't place anything in, because no
 * level gives them a stage rule for that source. */
function uncoveredStages(d: Dashboard): Problem[] {
  return d.stages.flatMap((s) =>
    PROVIDERS.filter((p) => {
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

/** Why an Amplify row can't show behind or diverged badges, if it can't:
 * it has no GitHub repo, or no GitHub token to read it with in some or
 * all of its cells (each cell resolves its own, spec.md §3.11). */
function noBadges(d: Dashboard, row: Row): string | undefined {
  if (row.type !== 'amplify') return undefined;
  if (row.repo === undefined) return 'no GitHub repo';
  const tokens = cellCredentials(d, row, 'githubToken');
  const without = d.stages.filter((s) => tokens.get(s.id) === undefined);
  if (without.length === 0) return undefined;
  return without.length === d.stages.length
    ? 'no GitHub credential'
    : `no GitHub credential in ${without.map((s) => s.name).join(', ')}`;
}

/** A note on each pinned app whose key no cell of its row reads with
 * (spec.md §3.12): it serves no cell until a column uses that key. */
function pinNotes(d: Dashboard): Problem[] {
  const nameOf = (id: string) =>
    d.credentials.find((c) => c.id === id)?.label ?? id;
  return d.rows.flatMap((row) =>
    row.type === 'amplify'
      ? unusedPins(d, row).map((pin) =>
          note(
            { kind: 'row', id: row.id },
            `Amplify app ${pin.appId} (${pin.region}) is pinned under the AWS key ${nameOf(pin.credentialId)}, which no column of this row reads with: set that AWS key on the columns that use it`,
            {
              kind: 'settings',
              place: { level: 'row', rowId: row.id },
              field: 'awsKey',
            },
          ),
        )
      : [],
  );
}

/** Every problem `d` has on its own. */
export function configProblems(d: Dashboard): Problem[] {
  const sources = {
    github: sourceRuleFor(d, 'github'),
    amplify: sourceRuleFor(d, 'amplify'),
  };
  const badges = d.rows.flatMap((row) => {
    const why = noBadges(d, row);
    return why
      ? [
          problem(
            { kind: 'row', id: row.id },
            `${why}, so no behind or diverged badges`,
            true,
          ),
        ]
      : [];
  });
  const sites = ruleSites(d);
  return [
    ...Object.values(sources).flatMap(sourceRuleProblems),
    ...referenceProblems(d),
    ...pinNotes(d),
    ...sites.flatMap((site) => siteProblems(site, sources[site.provider])),
    ...unusedSourceNotes(sites, d.rows),
    ...uncoveredStages(d),
    ...badges,
  ];
}
