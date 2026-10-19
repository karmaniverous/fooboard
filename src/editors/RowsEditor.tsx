/**
 * Rows (spec.md C-21): add a GitHub row by picking a repo the dashboard's
 * token can see (display name defaults to the repo without its owner), or
 * an Amplify row by choosing credential, region and app (listed via
 * `ListApps`); rename, reorder, remove; per-row token override, row key
 * and item rules (item rules when its source rule reads items), extra
 * Amplify sources, the row's group, its stage-rule overrides, and its
 * group's overrides and default credentials.
 *
 * @module
 */
import { useContext } from 'react';

import { ConfirmButton } from '@/components/ConfirmButton';
import type { Dashboard } from '@/domain/config/dashboard';
import { inheritedCredential } from '@/domain/config/inheritance';
import type { Row } from '@/domain/config/row';
import type { EngineProviders } from '@/engine';

import { CredentialSelect } from './CredentialSelect';
import { removeRow, rowFromRepo } from './edit';
import { CommitInput } from './fields';
import { listHandlers } from './groupEdit';
import { ReorderList } from './ReorderList';
import { RowGrouping } from './RowGrouping';
import { AddSource, AmplifyPicker, RepoPicker } from './rowPickers';
import { RuleEditor } from './rules/RuleEditor';
import { SourcesWithItemsContext } from './rules/samples';

export function RowsEditor({
  dashboard,
  providers,
  onChange,
  override,
}: {
  dashboard: Dashboard;
  providers: EngineProviders;
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
        targetOf={(r) => `row:${r.id}`}
        {...listHandlers(dashboard, 'rows', onChange)}
        onRemove={(r) => {
          onChange(removeRow(dashboard, r.id));
        }}
      >
        {(row) => (
          <div className="flex flex-col gap-2 text-xs">
            <div className="flex items-center gap-1">
              <CommitInput
                label={`Display name for ${row.repo}`}
                className="h-8 text-xs"
                value={row.displayName}
                onCommit={(displayName) => {
                  replaceRow({ ...row, displayName });
                }}
              />
              <span className="shrink-0 text-muted-foreground">
                {row.type === 'amplify' ? 'Amplify · ' : ''}
                {row.repo}
              </span>
            </div>
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
                rule={row.recordRule ?? { combine: 'and', checks: [] }}
                provider={row.type}
                target={`row:${row.id}:record`}
                onChange={(rule) => {
                  replaceRow({
                    ...row,
                    recordRule: rule.checks.length > 0 ? rule : undefined,
                  });
                }}
              />
            </div>
            {withItems.includes(row.type) && (
              <div className="flex flex-col gap-1">
                <span className="font-semibold">Items for this row</span>
                <RuleEditor
                  label={`Item rule for ${row.displayName}`}
                  rule={row.itemRule ?? { combine: 'and', checks: [] }}
                  newPath="$.name"
                  provider={row.type}
                  scope="item"
                  target={`row:${row.id}:items`}
                  onChange={(rule) => {
                    replaceRow({
                      ...row,
                      itemRule: rule.checks.length > 0 ? rule : undefined,
                    });
                  }}
                />
              </div>
            )}
            {row.type === 'amplify' && (
              <div className="flex flex-col gap-1">
                <span className="font-semibold">Sources</span>
                {row.sources.map((s, i) => (
                  <div
                    key={`${s.region}-${s.appId}`}
                    className="flex items-center gap-2"
                  >
                    <span>
                      {s.appId} in {s.region}
                    </span>
                    {row.sources.length > 1 && (
                      <ConfirmButton
                        confirmLabel={`Delete source ${s.appId}`}
                        onConfirm={() => {
                          replaceRow({
                            ...row,
                            sources: row.sources.filter((_, j) => j !== i),
                          });
                        }}
                      >
                        Delete source
                      </ConfirmButton>
                    )}
                  </div>
                ))}
                <AddSource
                  dashboard={dashboard}
                  name={row.displayName}
                  inherited={inheritedCredential(dashboard, row.id, 'aws')}
                  onAdd={(source) => {
                    replaceRow({ ...row, sources: [...row.sources, source] });
                  }}
                />
              </div>
            )}
            <RowGrouping
              dashboard={dashboard}
              providers={providers}
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
          providers={providers}
          onPick={(repo) => {
            onChange({
              ...dashboard,
              rows: [...dashboard.rows, rowFromRepo(repo, dashboard)],
            });
          }}
        />
        <AmplifyPicker
          dashboard={dashboard}
          providers={providers}
          onAdd={(row) => {
            onChange({ ...dashboard, rows: [...dashboard.rows, row] });
          }}
        />
      </section>
    </div>
  );
}
