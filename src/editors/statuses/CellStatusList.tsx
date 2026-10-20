/**
 * A status set's cell statuses, in order (spec.md A§4.3.6: the first
 * whose rule matches wins). Each collapses to its header (its colour,
 * name, the summary status it counts toward, move and delete), one open
 * at a time; a new status opens. Its fields and rule show when it is
 * open.
 *
 * @module
 */
import { CheckField } from '@/components/CheckField';
import { Choice, type ChoiceOption } from '@/components/Choice';
import { CollapsibleItem } from '@/components/CollapsibleItem';
import { Button } from '@/components/ui/button';
import type { StatusIcon, StatusSet } from '@/domain/config/statusSets';
import { move, patchAt } from '@/lib/lists';

import { CommitInput } from '../fields';
import { RuleEditor } from '../rules/RuleEditor';
import { type OpenRequest, useAccordion } from '../useAccordion';
import { addCellStatus } from './customSet';

export function CellStatusList({
  set,
  onChange,
  iconOptions,
  openStatus,
}: {
  set: StatusSet;
  onChange: (set: StatusSet) => void;
  iconOptions: readonly ChoiceOption<StatusIcon>[];
  /** A status to open and scroll to (one just added from outside). */
  openStatus?: OpenRequest;
}): React.JSX.Element {
  const accordion = useAccordion(
    set.cell.map((c) => ({ key: c.id, targets: [] })),
    openStatus,
  );
  const summaryOptions = set.summary.map((s) => ({
    value: s.id,
    label: s.name,
  }));
  const summaryName = (id: string) =>
    set.summary.find((s) => s.id === id)?.name ?? id;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold">
          Cell statuses (first match wins)
        </h4>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            onChange(addCellStatus(set));
          }}
        >
          Add status
        </Button>
      </div>
      {set.cell.map((c, i) => {
        const update = (change: Partial<typeof c>) => {
          onChange({ ...set, cell: patchAt(set.cell, i, change) });
        };
        return (
          <CollapsibleItem
            key={c.id}
            {...accordion.itemProps(c.id)}
            name={c.name}
            summary={`counts as ${summaryName(c.summary)}`}
            label={`Cell status ${c.name}`}
            className="gap-1 p-1"
            lead={
              <span
                aria-hidden
                className="size-3 shrink-0 rounded-sm border"
                style={{ backgroundColor: c.color }}
              />
            }
            actions={
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Move ${c.name} up`}
                  disabled={i === 0}
                  onClick={() => {
                    onChange({ ...set, cell: move(set.cell, i, -1) });
                  }}
                >
                  ↑
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Move ${c.name} down`}
                  disabled={i === set.cell.length - 1}
                  onClick={() => {
                    onChange({ ...set, cell: move(set.cell, i, 1) });
                  }}
                >
                  ↓
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Delete ${c.name}`}
                  disabled={set.cell.length === 1}
                  onClick={() => {
                    onChange({
                      ...set,
                      cell: set.cell.filter((_, j) => j !== i),
                    });
                  }}
                >
                  ×
                </Button>
              </>
            }
          >
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="color"
                  aria-label={`${c.name} colour`}
                  value={c.color}
                  onChange={(e) => {
                    update({ color: e.target.value });
                  }}
                />
                <CommitInput
                  label={`Cell status ${String(i + 1)} name`}
                  className="h-9 w-40"
                  value={c.name}
                  onCommit={(name) => {
                    update({ name });
                  }}
                />
                <Choice
                  label={`${c.name} counts toward`}
                  value={c.summary}
                  options={summaryOptions}
                  onValueChange={(summary) => {
                    update({ summary });
                  }}
                />
                <Choice
                  label={`${c.name} icon`}
                  value={c.icon ?? ''}
                  options={[
                    { value: '', label: 'Summary icon' },
                    ...iconOptions,
                  ]}
                  onValueChange={(icon) => {
                    update({ icon: icon || undefined });
                  }}
                />
                <CheckField
                  label="Outlined"
                  checked={c.outlined}
                  onCheckedChange={(outlined) => {
                    update({ outlined });
                  }}
                />
              </div>
              <RuleEditor
                provider={set.provider}
                label={`${c.name} rule`}
                rule={c.rule}
                onChange={(rule) => {
                  update({ rule });
                }}
              />
            </div>
          </CollapsibleItem>
        );
      })}
    </div>
  );
}
