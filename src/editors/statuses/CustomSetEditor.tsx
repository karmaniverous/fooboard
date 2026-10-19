/**
 * One of the dashboard's own status sets (spec.md A§4.3.6): its name, its
 * item rule (GitHub), its summary statuses and its cell statuses in order
 * (the first whose rule matches wins). Changes go to the dashboard, which
 * the editor validates before saving.
 *
 * @module
 */
import { STATUS_GLYPH } from '@/board/cellView';
import { Choice } from '@/components/Choice';
import { Button } from '@/components/ui/button';
import { STATUS_ICONS, type StatusSet } from '@/domain/config/statusSets';
import { move, patchAt } from '@/lib/lists';

import { CommitInput } from '../fields';
import { RuleEditor } from '../rules/RuleEditor';
import { addCellStatus } from './customSet';

const iconOptions = STATUS_ICONS.map((icon) => ({
  value: icon,
  label: `${STATUS_GLYPH[icon]} ${icon}`,
}));

export function CustomSetEditor({
  set,
  onChange,
  onRemove,
}: {
  set: StatusSet;
  onChange: (set: StatusSet) => void;
  /** Absent while the set is chosen somewhere (it can't be removed). */
  onRemove?: () => void;
}): React.JSX.Element {
  const jobs = set.provider === 'github';
  const summaryOptions = set.summary.map((s) => ({
    value: s.id,
    label: s.name,
  }));
  return (
    <section
      aria-label={`Status set ${set.name}`}
      className="flex flex-col gap-3 rounded border p-2"
    >
      <div className="flex items-center gap-2">
        <CommitInput
          label="Status set name"
          className="h-9 flex-1"
          value={set.name}
          onCommit={(name) => {
            onChange({ ...set, name });
          }}
        />
        <Button
          size="sm"
          variant="outline"
          disabled={!onRemove}
          title={onRemove ? undefined : 'In use: choose another set first'}
          onClick={onRemove}
        >
          Remove
        </Button>
      </div>
      {jobs && (
        <div className="flex flex-col gap-1">
          <h4 className="text-xs font-semibold">Jobs that count</h4>
          <RuleEditor
            provider={set.provider}
            scope="item"
            label="Item rule"
            rule={set.items}
            onChange={(items) => {
              onChange({ ...set, items });
            }}
          />
        </div>
      )}
      <div className="flex flex-col gap-1">
        <h4 className="text-xs font-semibold">Summary statuses</h4>
        {set.summary.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2">
            <input
              type="color"
              aria-label={`${s.name} colour`}
              value={s.color}
              onChange={(e) => {
                onChange({
                  ...set,
                  summary: patchAt(set.summary, i, { color: e.target.value }),
                });
              }}
            />
            <CommitInput
              label={`Summary status ${String(i + 1)} name`}
              className="h-9 flex-1"
              value={s.name}
              onCommit={(name) => {
                onChange({
                  ...set,
                  summary: patchAt(set.summary, i, { name }),
                });
              }}
            />
            <Choice
              label={`${s.name} icon`}
              value={s.icon}
              options={iconOptions}
              onValueChange={(icon) => {
                onChange({
                  ...set,
                  summary: patchAt(set.summary, i, { icon }),
                });
              }}
            />
            <label className="flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={s.inProgress}
                onChange={(e) => {
                  onChange({
                    ...set,
                    summary: patchAt(set.summary, i, {
                      inProgress: e.target.checked,
                    }),
                  });
                }}
              />
              In progress
            </label>
          </div>
        ))}
      </div>
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
            onChange({
              ...set,
              cell: patchAt(set.cell, i, change),
            });
          };
          return (
            <div
              key={c.id}
              role="group"
              aria-label={`Cell status ${c.name}`}
              className="flex flex-col gap-1 rounded border p-2"
            >
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
                    update({
                      icon: icon || undefined,
                    });
                  }}
                />
                <label className="flex items-center gap-1 text-xs">
                  <input
                    type="checkbox"
                    checked={c.outlined}
                    onChange={(e) => {
                      update({ outlined: e.target.checked });
                    }}
                  />
                  Outlined
                </label>
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
          );
        })}
      </div>
    </section>
  );
}
