/**
 * Rows (spec.md C-21): add a GitHub row by choosing a token (unset: the
 * dashboard default) and picking a repo it can see (display name defaults
 * to the repo without its owner; the row keeps the chosen token), or
 * an Amplify row by choosing credential, region and app (listed via
 * `ListApps`); rename, reorder, remove; per-row token override, row key
 * and item rules (item rules when its source rule reads items), an
 * Amplify row's sources and their AWS keys, the row's group, its stage-rule overrides, and its
 * group's overrides and default credentials.
 *
 * @module
 */
import { useContext } from 'react';

import type { Dashboard } from '@/domain/config/dashboard';
import { groupOf } from '@/domain/config/groups';
import { inheritedCredential } from '@/domain/config/inheritance';
import type { Row } from '@/domain/config/row';
import { ITEM_NAME_PATH } from '@/domain/model/keys';
import { always, unlessAlways } from '@/domain/rules/always';
import { targetKey } from '@/editors/editTarget';

import { AmplifySources } from './AmplifySources';
import { CredentialSelect } from './CredentialSelect';
import { removeRow, rowFromRepo } from './edit';
import { CommitInput } from './fields';
import { listHandlers } from './groupEdit';
import { ReorderList } from './ReorderList';
import { RepoPicker } from './RepoPicker';
import { RowGrouping } from './RowGrouping';
import { AmplifyPicker } from './rowPickers';
import { RuleEditor } from './rules/RuleEditor';
import { SourcesWithItemsContext } from './rules/samples';

/** A row's header summary: its repo, and its kind if not GitHub. */
const rowSummary = (row: Row): string =>
  `${row.type === 'amplify' ? 'Amplify · ' : ''}${row.repo}`;

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
  const withItems = useContext(SourcesWithItemsContext);
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
              label={`Display name for ${row.repo}`}
              className="h-8 text-xs"
              value={row.displayName}
              onCommit={(displayName) => {
                replaceRow({ ...row, displayName });
              }}
            />
            <CredentialSelect
              dashboard={dashboard}
              kind="github"
              value={
                row.type === 'github'
                  ? row.credentialId
                  : row.githubCredentialId
              }
              inherited={inheritedCredential(dashboard, row.id, 'github')}
              label={`GitHub token for ${row.displayName}`}
              onChange={(id) => {
                replaceRow(
                  row.type === 'github'
                    ? { ...row, credentialId: id }
                    : { ...row, githubCredentialId: id },
                );
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
            {withItems.includes(row.type) && (
              <div className="flex flex-col gap-1">
                <span className="font-semibold">Items for this row</span>
                <RuleEditor
                  label={`Item rule for ${row.displayName}`}
                  rule={row.itemRule ?? always}
                  newPath={ITEM_NAME_PATH}
                  provider={row.type}
                  scope="item"
                  target={targetKey({
                    kind: 'row',
                    id: row.id,
                    part: 'items',
                  })}
                  onChange={(rule) => {
                    replaceRow({
                      ...row,
                      itemRule: unlessAlways(rule),
                    });
                  }}
                />
              </div>
            )}
            {row.type === 'amplify' && (
              <AmplifySources
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
