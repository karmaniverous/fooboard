/**
 * Rows (spec.md C-21): add a GitHub row by picking a repo the dashboard's
 * token can see (display name defaults to the repo without its owner), or
 * an Amplify row by choosing credential, region and app (listed via
 * `ListApps`); rename, reorder, remove; per-row token override, row key
 * tests, extra Amplify sources and the divider before each row.
 *
 * @module
 */

import { ConfirmButton } from '@/components/ConfirmButton';
import type { Dashboard } from '@/domain/config/dashboard';
import { rowGroupOf } from '@/domain/config/groups';
import type { MatchTest } from '@/domain/config/matchTest';
import type { Row } from '@/domain/config/row';
import type { EngineProviders } from '@/engine';

import { removeRow, rowFromRepo } from './edit';
import { CommitInput, GroupControl, OverrideFields } from './fields';
import {
  deleteRowGroup,
  hasOverrides,
  renameRowGroup,
  reorderRows,
  setRowGroup,
  setRowGroupCredential,
  setRowGroupOverride,
  setRowOverride,
} from './groupEdit';
import { MatchTestsEditor } from './MatchTestsEditor';
import { ReorderList } from './ReorderList';
import {
  AddSource,
  AmplifyPicker,
  CredentialSelect,
  RepoPicker,
} from './rowPickers';

export function RowsEditor({
  dashboard,
  providers,
  onChange,
  draft,
}: {
  dashboard: Dashboard;
  providers: EngineProviders;
  onChange: (dashboard: Dashboard) => void;
  /** A row key test to pre-fill on one row. */
  draft?: { rowId: string; test: MatchTest };
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
        onReorder={(rows) => {
          onChange(reorderRows(dashboard, rows));
        }}
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
              label={`GitHub token for ${row.displayName}`}
              onChange={(id) => {
                replaceRow(
                  row.type === 'github'
                    ? { ...row, credentialId: id }
                    : { ...row, githubCredentialId: id },
                );
              }}
            />
            {row.type === 'github' ? (
              <MatchTestsEditor
                title={`Row key tests for ${row.displayName}`}
                fields={['jobName', 'workflowName']}
                tests={row.rowKeyTests}
                draft={draft?.rowId === row.id ? draft.test : undefined}
                onChange={(rowKeyTests) => {
                  replaceRow({ ...row, rowKeyTests });
                }}
              />
            ) : (
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
                  onAdd={(source) => {
                    replaceRow({ ...row, sources: [...row.sources, source] });
                  }}
                />
              </div>
            )}
            {(() => {
              const group = rowGroupOf(dashboard.rowGroups, row.id);
              return (
                <>
                  <GroupControl
                    name={row.displayName}
                    groups={dashboard.rowGroups}
                    groupId={group?.id}
                    warning={
                      group &&
                      group.memberIds.length === 1 &&
                      hasOverrides(group)
                        ? "Moving this row out deletes its group and the group's overrides and credentials."
                        : undefined
                    }
                    onChange={(target) => {
                      onChange(setRowGroup(dashboard, row.id, target));
                    }}
                    onRename={(id, label) => {
                      onChange(renameRowGroup(dashboard, id, label));
                    }}
                    onDelete={(id) => {
                      onChange(deleteRowGroup(dashboard, id));
                    }}
                  />
                  {group && (
                    <RowGroupSettings
                      dashboard={dashboard}
                      groupId={group.id}
                      onChange={onChange}
                    />
                  )}
                  <OverrideFields
                    name={row.displayName}
                    stages={dashboard.stages}
                    own={row.branchPatternOverrides}
                    inherited={(stageId) =>
                      group?.branchPatternOverrides[stageId] ??
                      dashboard.stages.find((s) => s.id === stageId)
                        ?.branchPattern ??
                      ''
                    }
                    onChange={(stageId, pattern) => {
                      onChange(
                        setRowOverride(dashboard, row.id, stageId, pattern),
                      );
                    }}
                  />
                </>
              );
            })()}
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

/** A row group's own settings (C-14c, C-1a): its branch-pattern
 * overrides and default credentials. Shown on each member row. */
function RowGroupSettings({
  dashboard,
  groupId,
  onChange,
}: {
  dashboard: Dashboard;
  groupId: string;
  onChange: (dashboard: Dashboard) => void;
}): React.JSX.Element | null {
  const group = dashboard.rowGroups.find((g) => g.id === groupId);
  if (!group) return null;
  const name = group.label ?? 'this group';
  return (
    <div className="flex flex-col gap-1 rounded border border-dashed p-1 text-xs">
      <span className="font-semibold">Group settings: {name}</span>
      <div className="flex flex-wrap items-center gap-1">
        <CredentialSelect
          dashboard={dashboard}
          kind="github"
          label={`GitHub token for ${name}`}
          value={group.defaultCredentials.github}
          onChange={(id) => {
            onChange(setRowGroupCredential(dashboard, groupId, 'github', id));
          }}
        />
        <CredentialSelect
          dashboard={dashboard}
          kind="aws"
          label={`AWS key for ${name}`}
          value={group.defaultCredentials.aws}
          onChange={(id) => {
            onChange(setRowGroupCredential(dashboard, groupId, 'aws', id));
          }}
        />
      </div>
      <OverrideFields
        name={name}
        stages={dashboard.stages}
        own={group.branchPatternOverrides}
        inherited={(stageId) =>
          dashboard.stages.find((s) => s.id === stageId)?.branchPattern ?? ''
        }
        onChange={(stageId, pattern) => {
          onChange(setRowGroupOverride(dashboard, groupId, stageId, pattern));
        }}
      />
    </div>
  );
}
