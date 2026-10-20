/**
 * One of the dashboard's own status sets (spec.md A§4.3.6): its name, its
 * item rule (when its source rule reads items), its summary statuses and
 * its cell statuses in order (the first whose rule matches wins; each
 * collapses to its header: `CellStatusList`). Changes go to the dashboard, which
 * the editor validates before saving.
 *
 * @module
 */
import { useContext } from 'react';

import { STATUS_GLYPH } from '@/board/cellView';
import { CheckField } from '@/components/CheckField';
import { Choice } from '@/components/Choice';
import {
  CollapsibleItem,
  type ItemOpenState,
} from '@/components/CollapsibleItem';
import { Button } from '@/components/ui/button';
import { PROVIDER_LABELS } from '@/domain/config/providers';
import { STATUS_ICONS, type StatusSet } from '@/domain/config/statusSets';
import { statusSetItemsKey, targetKey } from '@/editors/editTarget';
import { patchAt } from '@/lib/lists';

import { CommitInput } from '../fields';
import { RuleEditor } from '../rules/RuleEditor';
import { SourcesWithItemsContext } from '../rules/samples';
import type { OpenRequest } from '../useAccordion';
import { CellStatusList } from './CellStatusList';

const iconOptions = STATUS_ICONS.map((icon) => ({
  value: icon,
  label: `${STATUS_GLYPH[icon]} ${icon}`,
}));

export function CustomSetEditor({
  set,
  onChange,
  onRemove,
  item,
  openStatus,
}: {
  set: StatusSet;
  /** A cell status to open (one just added to this set). */
  openStatus?: OpenRequest;
  /** Open or collapsed to its header (one at a time: the owner's). */
  item: ItemOpenState;
  onChange: (set: StatusSet) => void;
  /** Absent while the set is chosen somewhere (it can't be removed). */
  onRemove?: () => void;
}): React.JSX.Element {
  const jobs = useContext(SourcesWithItemsContext).includes(set.provider);
  return (
    <CollapsibleItem
      {...item}
      name={set.name}
      summary={PROVIDER_LABELS[set.provider]}
      target={targetKey({ kind: 'statusSet', id: set.id })}
      label={`Status set ${set.name}`}
      actions={
        <Button
          size="sm"
          variant="outline"
          disabled={!onRemove}
          title={onRemove ? undefined : 'In use: choose another set first'}
          onClick={onRemove}
        >
          Remove
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <CommitInput
          label="Status set name"
          className="h-9"
          value={set.name}
          onCommit={(name) => {
            onChange({ ...set, name });
          }}
        />
        {jobs && (
          <div className="flex flex-col gap-1">
            <h4 className="text-xs font-semibold">Items that count</h4>
            <RuleEditor
              target={statusSetItemsKey(set.id)}
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
              <CheckField
                label="In progress"
                checked={s.inProgress}
                onCheckedChange={(inProgress) => {
                  onChange({
                    ...set,
                    summary: patchAt(set.summary, i, { inProgress }),
                  });
                }}
              />
            </div>
          ))}
        </div>
        <CellStatusList
          set={set}
          onChange={onChange}
          iconOptions={iconOptions}
          openStatus={openStatus}
        />
      </div>
    </CollapsibleItem>
  );
}
