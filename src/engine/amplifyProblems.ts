/**
 * The problems and notes of apps found by repo (spec.md §3.12): the
 * no-match problem per key, naming the columns, whose *Fix* opens the
 * row's pinned apps; the several-match problem, offering *Pin* on each
 * app; the note on a pin that is the only app the search finds for its
 * key, offering *Unpin*; and the dashboard note per key naming the
 * regions its search skipped for a denial or an opt-in server error.
 * Each is dismissable. Pure.
 *
 * @module
 */
import type { AmplifyRow, PinnedApp } from '@/domain/config/row';
import type { Stage } from '@/domain/config/stage';
import {
  type EditTarget,
  note,
  type Problem,
  problem,
} from '@/domain/problems/problem';
import { pinsFor, samePin } from '@/domain/settings/pins';
import type { NotedSkip } from '@/lib/amplify/regions';

import type { AccessContext, Part, SearchMatches } from './amplifyAccess';
import { searchedKeys } from './amplifyAccess';
import { type FoundApp, matchingApps, type NotedRegion } from './appSearch';

/** Names a key in messages (its label). */
export type KeyLabel = (credentialId: string) => string;

/** The row's pinned apps, where pins are made. */
const pinsTarget = (rowId: string): EditTarget => ({
  kind: 'row',
  id: rowId,
  part: 'pinnedApps',
});

const names = (stages: readonly Stage[]): string =>
  stages.map((s) => s.name).join(', ');

/** What a *No app* cell says (rung 4). */
export const noAppReason = (row: AmplifyRow): string =>
  row.repo === undefined
    ? "no app is pinned for this key's account"
    : `no app builds ${row.repo} in this key's account`;

/** The problem of the columns in `stages` reading with `key`, which have
 * no app. */
export function noAppProblem(
  row: AmplifyRow,
  key: string,
  stages: readonly Stage[],
  label: KeyLabel,
): Problem {
  const message =
    row.repo === undefined
      ? `No Amplify app is pinned for the AWS key ${label(key)}, and the row has no repo, so ${names(stages)} show No app: pin an app for that key`
      : `No Amplify app builds ${row.repo} in the account of the AWS key ${label(key)}, so ${names(stages)} show No app: pin the app, or, if the repo was renamed, update the row's repo`;
  return problem({ kind: 'row', id: row.id }, message, true, {
    target: pinsTarget(row.id),
  });
}

/** How `app` is named among `found`: by name and region, with its app ID
 * too when another found app shares both. */
const appName = (app: FoundApp, found: readonly FoundApp[]): string =>
  found.some(
    (other) =>
      other !== app && other.name === app.name && other.region === app.region,
  )
    ? `${app.name} (${app.region}, ${app.appId})`
    : `${app.name} (${app.region})`;

/** The problem of the several apps found building the row's repo under
 * `key`: every one is read; *Pin* chooses one (Q28). */
export function severalProblem(
  rowId: string,
  key: string,
  { repo, found }: SearchMatches,
  label: KeyLabel,
): Problem {
  return problem(
    { kind: 'row', id: rowId },
    `${String(found.length)} Amplify apps build ${repo} in the account of the AWS key ${label(key)}: ${found.map((app) => appName(app, found)).join(', ')}. The row reads them all; pin the one it should read`,
    true,
    {
      target: pinsTarget(rowId),
      actions: found.map((app) => ({
        kind: 'pin',
        rowId,
        pin: { credentialId: key, region: app.region, appId: app.appId },
        label: `Pin ${appName(app, found)}`,
      })),
    },
  );
}

/** Is `pin` the only app `key`'s search finds building `repo`, and the
 * only pin serving `key`? Unknown until the search is done. */
function foundAlone(
  ctx: Pick<AccessContext, 'search'>,
  row: AmplifyRow,
  repo: string,
  key: string,
  pin: PinnedApp,
): boolean {
  const pins = pinsFor(row, key);
  const search = ctx.search(key).state;
  if (pins.length !== 1 || search.kind !== 'done') return false;
  const found = matchingApps(search.apps, key, repo);
  return (
    found.length === 1 &&
    found[0]?.region === pin.region &&
    found[0].appId === pin.appId
  );
}

/** A note on each pin that every key it serves would find anyway, the
 * only app the search finds there, offering *Unpin*, so a migrated row
 * can go over to the search. */
export function unpinNotes(
  ctx: Pick<AccessContext, 'hasReader' | 'search'>,
  row: AmplifyRow,
  parts: readonly Part[],
  label: KeyLabel,
): Problem[] {
  const { repo } = row;
  if (repo === undefined) return [];
  const keys = searchedKeys(ctx, parts);
  return row.pinnedApps.flatMap((pin) => {
    const served = keys.filter((key) =>
      pinsFor(row, key).some((p) => samePin(p, pin)),
    );
    const alone =
      served.length > 0 &&
      served.every((key) => foundAlone(ctx, row, repo, key, pin));
    return alone
      ? [
          note(
            { kind: 'row', id: row.id },
            `Amplify app ${pin.appId} (${pin.region}) is the only app building ${repo} in the account of the AWS key ${served.map(label).join(', ')}, so the row finds it without the pin: unpin it to follow the repo`,
            pinsTarget(row.id),
            [
              {
                kind: 'unpin',
                rowId: row.id,
                pin,
                label: `Unpin ${pin.appId}`,
              },
            ],
          ),
        ]
      : [];
  });
}

/** Why a noted region was skipped, as the note says it. */
const SKIP_WORDS: Record<NotedSkip, string> = {
  denied: "an AWS organisation's policy denies it",
  unreachable: "it didn't answer",
};

/** The dashboard note naming the regions `key`'s search skipped so that
 * apps there can't be seen, if any. */
export function skippedRegionsNote(
  key: string,
  noted: readonly NotedRegion[],
  label: KeyLabel,
): Problem[] {
  if (noted.length === 0) return [];
  const regions = noted.map(
    ({ region, skip }) => `${region} (${SKIP_WORDS[skip]})`,
  );
  return [
    note(
      { kind: 'dashboard' },
      `The Amplify app search under the AWS key ${label(key)} skipped ${regions.join(', ')}, so apps there can't be seen`,
      { kind: 'settings', place: { level: 'dashboard' }, field: 'awsKey' },
    ),
  ];
}
