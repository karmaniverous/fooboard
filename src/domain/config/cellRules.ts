/**
 * A cell's rules (spec.md A§4.3.7): its row's record and item rules, its
 * stage rule, its status set and its source rule's order key. Pure.
 *
 * @module
 */
import type { CellRules } from '@/domain/model/cell';
import { sourceRuleFor } from '@/domain/model/sources';
import { resolveSetting } from '@/domain/settings/resolve';
import { statusSetFor } from '@/domain/statuses/resolve';

import type { Dashboard } from './dashboard';
import { recordRuleFor, stageRuleFor } from './placement';
import type { Row } from './row';

/** The rules for `row`'s cell in `stageId`: its item rule resolved for
 * the cell (spec.md §3.11). */
export function cellRulesFor(
  dashboard: Dashboard,
  row: Row,
  stageId: string,
): CellRules {
  return {
    record: recordRuleFor(dashboard, row),
    items: resolveSetting(dashboard, row, stageId, 'itemRules').value,
    stage: stageRuleFor(dashboard, row, stageId),
    set: statusSetFor(dashboard, row, stageId),
    order: sourceRuleFor(dashboard, row.type).order,
  };
}
