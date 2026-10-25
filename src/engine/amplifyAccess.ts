/**
 * Which apps each cell of an Amplify row reads (spec.md §3.12 *Which apps
 * a cell reads*): for a cell whose AWS key resolves to K, the row's apps
 * pinned for K; else its pinned apps with no key; else, when the row has
 * a repo, the apps K's search finds building it; else none (*No app*). A
 * cell with no key, or no secret for K, reads nothing (*Needs
 * credential*). The row's columns split into parts by key, each part
 * reading one set of apps. The search runs for every key a cell of the
 * row reads with, pinned or not, so the notes on pins can be computed.
 * Pure.
 *
 * @module
 */
import { unique } from 'radash';

import type { AmplifyRow } from '@/domain/config/row';
import type { Stage } from '@/domain/config/stage';
import { pinsFor } from '@/domain/settings/pins';
import type { ResolvedAmplifySource } from '@/lib/amplify/rowJobs';
import { appKey } from '@/lib/amplify/rowJobs';

import { type AppSearch, type FoundApp, matchingApps } from './appSearch';
import { type Segment, segments } from './cellSegments';
import type { Need } from './need';
import type { FailureOutcome } from './providerOutcome';

/** What working out a row's access needs. */
export interface AccessContext {
  stages: readonly Stage[];
  /** The AWS key a row's cell resolves to (spec.md §3.11). */
  keyFor: (row: AmplifyRow, stageId: string) => string | undefined;
  /** A secret is entered for the AWS credential. */
  hasReader: (credentialId: string) => boolean;
  /** The app search under a key, from the cache. */
  search: (credentialId: string) => AppSearch;
}

/** The apps the search found building `repo`. */
export interface SearchMatches {
  repo: string;
  found: FoundApp[];
}

/** What a part of a row reads under its key, or why it reads nothing. */
export type Access =
  /** `key`: none set at any level; `secret`: none entered for it. */
  | { kind: 'missing'; missing: 'key' | 'secret' }
  | ({ key: string } & (
      | {
          kind: 'apps';
          apps: ResolvedAmplifySource[];
          /** What the search found, when the apps are its matches. */
          search?: SearchMatches;
        }
      | { kind: 'searching' }
      | { kind: 'failed'; region: string; outcome: FailureOutcome }
      /** No app builds the row's repo in the key's account, or the row
       * has no repo and no pin serves the key. */
      | { kind: 'none' }
    ));

/** Columns reading with one key, and what they read. */
export interface Part extends Segment<string | undefined> {
  access: Access;
}

/** What a cell resolving to `key` reads. */
function accessFor(
  ctx: Pick<AccessContext, 'hasReader' | 'search'>,
  row: AmplifyRow,
  key: string | undefined,
): Access {
  if (key === undefined) return { kind: 'missing', missing: 'key' };
  if (!ctx.hasReader(key)) return { kind: 'missing', missing: 'secret' };
  const pins = pinsFor(row, key);
  if (pins.length > 0)
    return {
      kind: 'apps',
      key,
      apps: pins.map((pin) => ({ ...pin, credentialId: key })),
    };
  if (row.repo === undefined) return { kind: 'none', key };
  const search = ctx.search(key).state;
  if (search.kind === 'loading') return { kind: 'searching', key };
  if (search.kind === 'failed') return { ...search, key };
  const found = matchingApps(search.apps, key, row.repo);
  return found.length > 0
    ? {
        kind: 'apps',
        key,
        apps: found.map(({ credentialId, region, appId }) => ({
          credentialId,
          region,
          appId,
        })),
        search: { repo: row.repo, found },
      }
    : { kind: 'none', key };
}

/** `row`'s columns split by the key their cells resolve to, each with
 * what it reads. */
export const rowParts = (ctx: AccessContext, row: AmplifyRow): Part[] =>
  segments(ctx.stages, (stageId) => ctx.keyFor(row, stageId)).map((s) => ({
    ...s,
    access: accessFor(ctx, row, s.key),
  }));

/** The keys with a secret that `parts` read with, once each. */
export const searchedKeys = (
  ctx: Pick<AccessContext, 'hasReader'>,
  parts: readonly Part[],
): string[] =>
  unique(
    parts.flatMap(({ key }) =>
      key !== undefined && ctx.hasReader(key) ? [key] : [],
    ),
  );

/** The search queries `row` needs: one search per key it reads with. */
export const searchNeeds = (
  ctx: AccessContext,
  parts: readonly Part[],
): Need[] => searchedKeys(ctx, parts).flatMap((key) => ctx.search(key).needs);

/** An app a row reads, and the columns reading it. */
export interface ReadApp {
  app: ResolvedAmplifySource;
  stageIds: string[];
}

/** Every app any cell of `row` reads, once each, with the columns that
 * read it (a part's apps are read by every column of the part). */
export function readApps(ctx: AccessContext, row: AmplifyRow): ReadApp[] {
  const byKey = new Map<string, ReadApp>();
  for (const { access, stages } of rowParts(ctx, row)) {
    if (access.kind !== 'apps') continue;
    for (const app of access.apps) {
      const read = byKey.get(appKey(app)) ?? { app, stageIds: [] };
      read.stageIds.push(...stages.map((s) => s.id));
      byKey.set(appKey(app), read);
    }
  }
  return [...byKey.values()];
}

/** Every app any cell of `row` reads, once each. */
export const rowApps = (
  ctx: AccessContext,
  row: AmplifyRow,
): ResolvedAmplifySource[] => readApps(ctx, row).map((r) => r.app);
