/**
 * The credentials a row's cells read (spec.md §3.11–3.12): each cell's
 * GitHub token and AWS key resolve on their own, so one row may read with
 * several. A row with no column yet reads what it would absent column
 * settings. A credential is named by its label in messages. Pure.
 *
 * @module
 */
import { unique } from 'radash';

import type { Dashboard } from '@/domain/config/dashboard';
import type { Row } from '@/domain/config/row';

import { rowReads } from './reads';
import { resolveSetting, rowSetting } from './resolve';

/** A credential's name: its label, or its id if the dashboard has no
 * such credential. */
export const credentialName = (
  d: Pick<Dashboard, 'credentials'>,
  id: string,
): string => d.credentials.find((c) => c.id === id)?.label ?? id;

/** Each column's resolved credential for `row` (`undefined`: none), by
 * stage id, in board order. */
export function cellCredentials(
  d: Dashboard,
  row: Row,
  field: 'githubToken' | 'awsKey',
): Map<string, string | undefined> {
  if (!rowReads(row, { field }))
    return new Map(d.stages.map((s) => [s.id, undefined]));
  return new Map(
    d.stages.map((s) => [s.id, resolveSetting(d, row, s.id, field).value]),
  );
}

/** The distinct credentials `row`'s cells read for `field`; with no
 * column, the one the row itself would read. */
export function rowCredentials(
  d: Dashboard,
  row: Row,
  field: 'githubToken' | 'awsKey',
): string[] {
  if (!rowReads(row, { field })) return [];
  const ids =
    d.stages.length > 0
      ? [...cellCredentials(d, row, field).values()]
      : [rowSetting(d, row, field).value];
  return unique(ids.filter((id): id is string => id !== undefined));
}
