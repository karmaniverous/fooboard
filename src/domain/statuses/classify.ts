/**
 * Which cell status a record takes (spec.md A§4.3.7): the first in the
 * set whose rule matches, or none (the cell shows Unknown).
 *
 * @module
 */
import type { JSONValue } from 'json-p3';

import type { CellStatus, StatusSet } from '@/domain/config/statusSets';
import { evaluateRule } from '@/domain/rules/check';

/** The first cell status in `set` whose rule `record` matches, if any. */
export const classify = (
  record: JSONValue,
  set: Pick<StatusSet, 'cell'>,
): CellStatus | undefined => set.cell.find((s) => evaluateRule(s.rule, record));
