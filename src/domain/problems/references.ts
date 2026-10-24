/**
 * References that don't resolve (spec.md A§4.3.7 *Data model version*,
 * *Consistency*): an unknown source-rule or status-set id, or a status set
 * chosen for a row of another source. These never stop a board loading:
 * the built-in default is used, and a problem is reported at the level
 * that holds the reference. Pure.
 *
 * @module
 */
import type { Dashboard } from '@/domain/config/dashboard';
import {
  type Provider,
  PROVIDER_LABELS,
  PROVIDERS,
} from '@/domain/config/providers';
import { DEFAULT_STATUS_SET_IDS } from '@/domain/config/statusSets';
import { builtinSourceFor } from '@/domain/model/builtinSources';
import { findSourceRule } from '@/domain/model/sources';
import { heldSettings } from '@/domain/settings/places';
import { presetById } from '@/domain/statuses/presets';
import { findStatusSet } from '@/domain/statuses/resolve';

import { levelOfPlace, type Problem, problem } from './problem';

/** Why `found` can't serve `provider`, or `undefined` when it can. */
function mismatch(
  id: string,
  found: { provider: Provider } | undefined,
  provider: Provider,
  noun: string,
): string | undefined {
  if (!found) return `unknown ${noun} ${id}`;
  return found.provider === provider
    ? undefined
    : `${noun} ${id} is for ${PROVIDER_LABELS[found.provider]}, not ${PROVIDER_LABELS[provider]}`;
}

/** Source rules the dashboard names that are unknown or another
 * source's. */
function sourceRefProblems(d: Dashboard): Problem[] {
  return PROVIDERS.flatMap((p) => {
    const id = d.sourceRules[p];
    const why = mismatch(
      id,
      findSourceRule(id, d.customSourceRules),
      p,
      'source rule',
    );
    return why
      ? [
          problem(
            { kind: 'dashboard' },
            `${why}: using the built-in ${builtinSourceFor(p).name} rule`,
            false,
            { target: { kind: 'source', provider: p } },
          ),
        ]
      : [];
  });
}

/** Status sets chosen at each level (spec.md §3.11) that are unknown,
 * or for another source than the one they are set for. */
function statusSetRefProblems(d: Dashboard): Problem[] {
  const stageIds = new Set(d.stages.map((s) => s.id));
  return heldSettings(d).flatMap(({ place, settings }) =>
    PROVIDERS.flatMap((provider) => {
      const id = settings.statusSets?.[provider];
      if (id === undefined) return [];
      if (place.level === 'cell' && !stageIds.has(place.stageId)) return [];
      const why = mismatch(
        id,
        findStatusSet(id, d.customStatusSets),
        provider,
        'status set',
      );
      return why
        ? [
            problem(
              levelOfPlace(place),
              `${why}: using ${presetById(DEFAULT_STATUS_SET_IDS[provider]).name}`,
              false,
              {
                target: {
                  kind: 'settings',
                  place,
                  field: 'statusSets',
                  source: provider,
                },
              },
            ),
          ]
        : [];
    }),
  );
}

/** Every reference in `d` that doesn't resolve. */
export const referenceProblems = (d: Dashboard): Problem[] => [
  ...sourceRefProblems(d),
  ...statusSetRefProblems(d),
];
