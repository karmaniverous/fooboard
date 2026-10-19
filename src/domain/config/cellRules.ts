/**
 * A cell's rules (spec.md A§4.3.7): its row's record and item rules, its
 * stage rule, its status set and its source rule's order key. Pure.
 *
 * @module
 */
import type { CellRules } from '@/domain/model/cell';
import type { SourceRule } from '@/domain/model/sourceRule';
import { sourceRuleFor } from '@/domain/model/sources';
import { statusSetFor } from '@/domain/statuses/resolve';

import type { Dashboard } from './dashboard';
import { rowRulesFor, stageRuleFor } from './placement';
import type { Row } from './row';

/** The source rule `dashboard` uses for `provider`. */
export const sourceFor = (
  dashboard: Pick<Dashboard, 'sourceRules' | 'customSourceRules'>,
  provider: Row['type'],
): SourceRule => sourceRuleFor(dashboard, provider);

/** The rules for `row`'s cell in `stageId`. */
export function cellRulesFor(
  dashboard: Dashboard,
  row: Row,
  stageId: string,
): CellRules {
  const { record, items } = rowRulesFor(dashboard, row);
  return {
    record,
    items,
    stage: stageRuleFor(dashboard, row, stageId),
    set: statusSetFor(dashboard, row, stageId),
    order: sourceFor(dashboard, row.type).order,
  };
}
