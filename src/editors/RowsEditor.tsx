/**
 * Rows (spec.md C-21): add a GitHub row by choosing a token (unset: the
 * dashboard default) and picking a repo it can see (display name defaults
 * to the repo without its owner; the row keeps the chosen token), or
 * an Amplify row by choosing credential, region and app (listed via
 * `ListApps`); rename, reorder, remove; the row's record rule, its
 * *Settings* and *Cell settings* (the shared settings editor, spec.md
 * §3.11), an Amplify row's pinned apps, the row's group, its stage-rule
 * overrides, and its group's settings and overrides.
 *
 * @module
 */
import type { Dashboard } from '@/domain/config/dashboard';
import { groupOf } from '@/domain/config/groups';
import type { Row } from '@/domain/config/row';
import { always, unlessAlways } from '@/domain/rules/always';
import { targetKey } from '@/editors/editTarget';

import { removeRow, rowFromRepo } from './edit';
import { CommitInput } from './fields';
import { listHandlers } from './groupEdit';
import { PinnedApps } from './PinnedApps';
import { ReorderList } from './ReorderList';
import { RepoPicker } from './RepoPicker';
import { RowGrouping } from './RowGrouping';
import { AmplifyPicker } from './rowPickers';
import { RuleEditor } from './rules/RuleEditor';
import { CellSettings } from './settings/CellSettings';
import { SettingsEditor } from './settings/SettingsEditor';

/** A row's header summary: its repo, and its kind if not GitHub. */
const rowSummary = (row: Row): string =>
  `${row.type === 'amplify' ? 'Amplify · ' : ''}${row.repo ?? 'no GitHub repo'}`;

export function RowsEditor({
  dashboard,
  onChange,
  override,
}: {
  dashboard: Dashboard;
  onChange: (dashboard: Dashboard) => void;
  /** *Add override*: a branch to offer on the rows reading a record. */
  override?: { branch: string; rowIds: readonly string[] };
}): React.JSX.Element {
  const replaceRow = (row: Row) => {
    onChange({
      ...dashboard,
      rows: dashboard.rows.map((r) => (r.id === row.id ? row : r)),
    });
  };
  return (
    <div className="flex flex-col gap-3 text-sm">
      <ReorderList
        items={dashboard.rows}
        keyOf={(r) => r.id}
        nameOf={(r) => r.displayName}
        summaryOf={rowSummary}
        targetOf={(r) => `row:${r.id}`}
        holdsTargets={(r) => {
          const group = groupOf(dashboard.rowGroups, r.id);
          return group ? [targetKey({ kind: 'rowGroup', id: group.id })] : [];
        }}
        {...listHandlers(dashboard, 'rows', onChange)}
        onRemove={(r) => {
          onChange(removeRow(dashboard, r.id));
        }}
      >
        {(row) => (
          <div className="flex flex-col gap-2 text-xs">
            <CommitInput
              label={`Display name for ${row.repo ?? row.id}`}
              className="h-8 text-xs"
              value={row.displayName}
              onCommit={(displayName) => {
                replaceRow({ ...row, displayName });
              }}
            />
            <div className="flex flex-col gap-1">
              <span className="font-semibold">Records for this row</span>
              <RuleEditor
                label={`Record rule for ${row.displayName}`}
                rule={row.recordRule ?? always}
                provider={row.type}
                target={targetKey({
                  kind: 'row',
                  id: row.id,
                  part: 'record',
                })}
                onChange={(rule) => {
                  replaceRow({
                    ...row,
                    recordRule: unlessAlways(rule),
                  });
                }}
              />
            </div>
            <SettingsEditor
              dashboard={dashboard}
              place={{ level: 'row', rowId: row.id }}
              onChange={onChange}
            />
            <CellSettings dashboard={dashboard} row={row} onChange={onChange} />
            {row.type === 'amplify' && (
              <PinnedApps
                dashboard={dashboard}
                row={row}
                onChange={replaceRow}
              />
            )}
            <RowGrouping
              dashboard={dashboard}
              row={row}
              override={override}
              onChange={onChange}
            />
          </div>
        )}
      </ReorderList>

      <section className="flex flex-col gap-2 rounded-md border p-2">
        <h3 className="font-semibold">Add a row</h3>
        <RepoPicker
          dashboard={dashboard}
          onPick={(repo, credentialId) => {
            onChange({
              ...dashboard,
              rows: [
                ...dashboard.rows,
                rowFromRepo(repo, dashboard, credentialId),
              ],
            });
          }}
        />
        <AmplifyPicker
          dashboard={dashboard}
          onAdd={(row) => {
            onChange({ ...dashboard, rows: [...dashboard.rows, row] });
          }}
        />
      </section>
    </div>
  );
}
