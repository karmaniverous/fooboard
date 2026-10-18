/**
 * A row's or stage's group (spec.md C-14b, C-21): no group, an existing
 * group, or a new group started from it; the group's label; delete the
 * group (its members stay, ungrouped). The same control on both axes.
 *
 * @module
 */
import { ConfirmButton } from '@/components/ConfirmButton';
import { NativeSelect } from '@/components/NativeSelect';
import type { Dashboard } from '@/domain/config/dashboard';
import { groupOf } from '@/domain/config/groups';

import { CommitInput } from './fields';
import {
  deleteGroup,
  type GroupAxis,
  groupsOn,
  renameGroup,
  setGroup,
} from './groupEdit';
import { carriesSettings } from './overrideEdit';

export function GroupControl({
  dashboard,
  axis,
  itemId,
  name,
  onChange,
}: {
  dashboard: Dashboard;
  axis: GroupAxis;
  itemId: string;
  /** The row or stage name, for labels. */
  name: string;
  onChange: (dashboard: Dashboard) => void;
}): React.JSX.Element {
  const groups = groupsOn(dashboard, axis);
  const current = groupOf(groups, itemId);
  // Leaving a row group as its last member deletes what it carries.
  const rowGroup =
    axis === 'rows' ? groupOf(dashboard.rowGroups, itemId) : undefined;
  const losesSettings =
    rowGroup?.memberIds.length === 1 && carriesSettings(rowGroup);
  return (
    <div className="flex flex-wrap items-center gap-1 text-xs">
      <NativeSelect
        aria-label={`Group of ${name}`}
        className="h-7 px-1"
        value={current?.id ?? ''}
        onChange={(e) => {
          onChange(setGroup(dashboard, axis, itemId, e.target.value || null));
        }}
      >
        <option value="">No group</option>
        {groups.map((g) => (
          <option key={g.id} value={g.id}>
            Group: {g.label ?? '(no label)'}
          </option>
        ))}
        <option value="new">New group from {name}</option>
      </NativeSelect>
      {current && (
        <>
          <CommitInput
            optional
            label={`Label of the group of ${name}`}
            placeholder="Group label (optional)"
            className="h-7 text-xs"
            value={current.label ?? ''}
            onCommit={(label) => {
              onChange(renameGroup(dashboard, axis, current.id, label));
            }}
          />
          <ConfirmButton
            confirmLabel={`Delete the group ${current.label ?? ''} (its members stay, ungrouped)`}
            onConfirm={() => {
              onChange(deleteGroup(dashboard, axis, current.id));
            }}
          >
            Delete group
          </ConfirmButton>
        </>
      )}
      {losesSettings && (
        <span className="text-status-failure">
          Moving this row out deletes its group and the group&apos;s overrides
          and credentials.
        </span>
      )}
    </div>
  );
}
