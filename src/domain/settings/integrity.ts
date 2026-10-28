/**
 * Settings a row or cell may not hold (spec.md §3.11 *Fallbacks*): a
 * setting for another source, an AWS key on a GitHub row (it reads no
 * account), or a GitHub token on an Amplify row without a repo (nothing
 * reads it). These are schema errors, not problems. Pure.
 *
 * @module
 */
import type { Row } from '@/domain/config/row';

import type { Settings } from './schema';

type Issue = { message: string; path: (string | number)[] };

/** What `settings`, held by `row` or one of its cells at `path`, may not
 * set. */
function heldIssues(
  row: Row,
  settings: Settings,
  path: (string | number)[],
): Issue[] {
  const other = row.type === 'github' ? 'amplify' : 'github';
  return [
    ...(['statusSets', 'itemRules'] as const).flatMap((field) =>
      settings[field]?.[other] === undefined
        ? []
        : [
            {
              message: `a ${row.type} row cannot set the ${other} ${field === 'statusSets' ? 'status set' : 'item rule'}`,
              path: [...path, field, other],
            },
          ],
    ),
    ...(row.type === 'github' && settings.awsKey !== undefined
      ? [
          {
            message: 'a GitHub row reads no AWS key',
            path: [...path, 'awsKey'],
          },
        ]
      : []),
    ...(row.type === 'amplify' &&
    row.repo === undefined &&
    settings.githubToken !== undefined
      ? [
          {
            message: 'an Amplify row without a repo reads no GitHub token',
            path: [...path, 'githubToken'],
          },
        ]
      : []),
  ];
}

/** Every setting `row` (at `index` in `rows`) or its cells may not hold. */
export const rowSettingsIssues = (row: Row, index: number): Issue[] => [
  ...heldIssues(row, row.settings, ['rows', index, 'settings']),
  ...Object.entries(row.cellSettings).flatMap(([stageId, settings]) =>
    heldIssues(row, settings, ['rows', index, 'cellSettings', stageId]),
  ),
];
