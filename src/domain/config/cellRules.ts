/**
 * A cell's rules (spec.md A§4.3.7): its row's record and item rules, its
 * stage rule, its status set and its source rule's order key. Pure.
 *
 * @module
 */
import { BUILTIN_SOURCES } from '@/domain/model/builtinSources';
import type { CellRules } from '@/domain/model/cell';
import type { SourceRule } from '@/domain/model/sourceRule';
import { statusSetFor } from '@/domain/statuses/resolve';

import type { Dashboard } from './dashboard';
import { rowRulesFor, stageRuleFor } from './placement';
import type { Row } from './row';

/** The source rule for `provider` (built-in until boards carry their
 * own). */
export function sourceFor(provider: Row['type']): SourceRule {
  const rule = BUILTIN_SOURCES.find((s) => s.provider === provider);
  if (!rule) throw new Error(`no source rule for ${provider}`);
  return rule;
}

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
    order: sourceFor(row.type).order,
  };
}
