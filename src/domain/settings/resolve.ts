/**
 * Resolving settings (spec.md §3.11, Decision 51): a fixed lattice, not
 * configurable. Most specific tier first: the cell; the row and the
 * column; the row group and the column group; the dashboard; the
 * built-in. Within a tier, when both axes set a field, its home axis wins
 * (`HOME`). The first level that sets a value wins outright; values never
 * merge. `inheritedAt` is the same walk with a place's own object left
 * out (what an editor shows as inherited); `shadowsAt` lists the more
 * specific places that set a field and win where they meet a place.
 * Pure.
 *
 * @module
 */
import type { Dashboard } from '@/domain/config/dashboard';
import { groupOf } from '@/domain/config/groups';
import type { Provider } from '@/domain/config/providers';
import type { Row } from '@/domain/config/row';
import { DEFAULT_STATUS_SET_IDS } from '@/domain/config/statusSets';
import { always } from '@/domain/rules/always';
import type { Rule } from '@/domain/rules/schema';

import { settingsAt, type SettingsPlace } from './places';
import { HOME, readSetting, type SettingField } from './schema';

/** Where a resolved value comes from: a place, or the built-in. */
export type Origin = SettingsPlace | { level: 'builtIn' };

export interface Resolved<T> {
  value: T;
  origin: Origin;
}

/** What a field resolves to: a credential may be none; a status set and
 * an item rule always have a built-in. */
export interface ResolvedValues {
  githubToken: string | undefined;
  awsKey: string | undefined;
  statusSets: string;
  itemRules: Rule;
}

/** What each field is when no level sets it (§3.11 *Shape*). */
const BUILT_IN: {
  [F in SettingField]: (source: Provider) => ResolvedValues[F];
} = {
  githubToken: () => undefined,
  awsKey: () => undefined,
  statusSets: (source) => DEFAULT_STATUS_SET_IDS[source],
  itemRules: () => always,
};

/** One tier of two axes, the field's home axis first. */
const tier = (
  field: SettingField,
  rowSide: SettingsPlace,
  columnSide: SettingsPlace,
): SettingsPlace[] =>
  HOME[field] === 'row' ? [rowSide, columnSide] : [columnSide, rowSide];

/** The first candidate setting `field`, else the built-in. */
function walk<F extends SettingField>(
  d: Dashboard,
  candidates: readonly SettingsPlace[],
  field: F,
  source: Provider,
): Resolved<ResolvedValues[F]> {
  for (const place of candidates) {
    const value = readSetting(settingsAt(d, place), field, source);
    if (value !== undefined) return { value, origin: place };
  }
  return { value: BUILT_IN[field](source), origin: { level: 'builtIn' } };
}

/** The places a row's cell in `stageId` reads, most specific first. */
function cellLattice(
  d: Dashboard,
  row: Pick<Row, 'id'>,
  stageId: string,
  field: SettingField,
  withCell: boolean,
): SettingsPlace[] {
  const rowGroup = groupOf(d.rowGroups, row.id);
  const columnGroup = groupOf(d.columnGroups, stageId);
  const groups: SettingsPlace[] = [
    ...(rowGroup ? [{ level: 'rowGroup', groupId: rowGroup.id } as const] : []),
    ...(columnGroup
      ? [{ level: 'columnGroup', groupId: columnGroup.id } as const]
      : []),
  ];
  return [
    ...(withCell ? [{ level: 'cell', rowId: row.id, stageId } as const] : []),
    ...tier(
      field,
      { level: 'row', rowId: row.id },
      { level: 'column', stageId },
    ),
    // A row or stage in no group has nothing at that tier.
    ...(HOME[field] === 'row' ? groups : [...groups].reverse()),
    { level: 'dashboard' },
  ];
}

/** What `row`'s cell in `stageId` reads for `field`, and where from. */
export const resolveSetting = <F extends SettingField>(
  d: Dashboard,
  row: Pick<Row, 'id' | 'type'>,
  stageId: string,
  field: F,
): Resolved<ResolvedValues[F]> =>
  walk(d, cellLattice(d, row, stageId, field, true), field, row.type);

/** The places `place` inherits from, most specific first: the same walk
 * without its own object. A row leaves out the columns (they vary across
 * it), a column the rows. */
function inheritedPlaces(
  d: Dashboard,
  place: SettingsPlace,
  field: SettingField,
): SettingsPlace[] {
  const dashboard: SettingsPlace = { level: 'dashboard' };
  switch (place.level) {
    case 'dashboard':
      return [];
    case 'rowGroup':
    case 'columnGroup':
      return [dashboard];
    case 'row': {
      const group = groupOf(d.rowGroups, place.rowId);
      return group
        ? [{ level: 'rowGroup', groupId: group.id }, dashboard]
        : [dashboard];
    }
    case 'column': {
      const group = groupOf(d.columnGroups, place.stageId);
      return group
        ? [{ level: 'columnGroup', groupId: group.id }, dashboard]
        : [dashboard];
    }
    case 'cell':
      return cellLattice(d, { id: place.rowId }, place.stageId, field, false);
  }
}

/** What `place` inherits for `field` (for `source`'s rows), and where
 * from. */
export const inheritedAt = <F extends SettingField>(
  d: Dashboard,
  place: SettingsPlace,
  field: F,
  source: Provider,
): Resolved<ResolvedValues[F]> =>
  walk(d, inheritedPlaces(d, place, field), field, source);

/** What `row` reads for `field` absent column and cell settings: its
 * own, else its row group's, the dashboard's or the built-in. For what a
 * row reads before it has a column (branch discovery on an empty
 * board). */
export const rowSetting = <F extends SettingField>(
  d: Dashboard,
  row: Pick<Row, 'id' | 'type'>,
  field: F,
): Resolved<ResolvedValues[F]> => {
  const place: SettingsPlace = { level: 'row', rowId: row.id };
  return walk(d, [place, ...inheritedPlaces(d, place, field)], field, row.type);
};

/** The rows `place` reaches, of `source`'s type. */
const rowsOf = (d: Dashboard, source: Provider, ids?: readonly string[]) =>
  d.rows.filter(
    (r) => r.type === source && (ids === undefined || ids.includes(r.id)),
  );

/** The more specific places that set `field` (for `source`) and win
 * where they meet `place` (spec.md §3.11 *What an editor shows as
 * inherited*). The dashboard has none: every level can override it. */
export function shadowsAt(
  d: Dashboard,
  place: SettingsPlace,
  field: SettingField,
  source: Provider,
): SettingsPlace[] {
  const columnHome = HOME[field] === 'column';
  const sets = (p: SettingsPlace) =>
    readSetting(settingsAt(d, p), field, source) !== undefined;
  const cells = (rows: readonly Row[], stageIds: readonly string[]) =>
    rows.flatMap((r) =>
      stageIds.map((stageId): SettingsPlace => ({
        level: 'cell',
        rowId: r.id,
        stageId,
      })),
    );
  const rowPlaces = (rows: readonly Row[]) =>
    rows.map((r): SettingsPlace => ({ level: 'row', rowId: r.id }));
  const columnPlaces = (stageIds: readonly string[]) =>
    stageIds.map((stageId): SettingsPlace => ({ level: 'column', stageId }));
  const allStages = d.stages.map((s) => s.id);
  const allRows = rowsOf(d, source);
  const candidates = ((): SettingsPlace[] => {
    switch (place.level) {
      case 'dashboard':
      case 'cell':
        return [];
      case 'row':
        return [
          ...cells(rowsOf(d, source, [place.rowId]), allStages),
          ...(columnHome ? columnPlaces(allStages) : []),
        ];
      case 'column':
        return [
          ...cells(allRows, [place.stageId]),
          ...(columnHome ? [] : rowPlaces(allRows)),
        ];
      case 'rowGroup': {
        const members =
          d.rowGroups.find((g) => g.id === place.groupId)?.memberIds ?? [];
        const rows = rowsOf(d, source, members);
        return [
          ...rowPlaces(rows),
          ...cells(rows, allStages),
          ...columnPlaces(allStages),
          ...(columnHome
            ? d.columnGroups.map((g): SettingsPlace => ({
                level: 'columnGroup',
                groupId: g.id,
              }))
            : []),
        ];
      }
      case 'columnGroup': {
        const members =
          d.columnGroups.find((g) => g.id === place.groupId)?.memberIds ?? [];
        return [
          ...columnPlaces(members),
          ...cells(allRows, members),
          ...rowPlaces(allRows),
          ...(columnHome
            ? []
            : d.rowGroups.map((g): SettingsPlace => ({
                level: 'rowGroup',
                groupId: g.id,
              }))),
        ];
      }
    }
  })();
  return candidates.filter(sets);
}
