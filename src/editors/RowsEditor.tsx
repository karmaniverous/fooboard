/**
 * Rows (spec.md C-21): add a GitHub row by picking a repo the dashboard's
 * token can see (display name defaults to the repo without its owner), or
 * an Amplify row by choosing credential, region and app (listed via
 * `ListApps`); rename, reorder, remove; per-row token override, row key
 * tests, extra Amplify sources, the row's group, its branch-pattern
 * overrides, and its group's overrides and default credentials.
 *
 * @module
 */

import { useState } from 'react';

import { ConfirmButton } from '@/components/ConfirmButton';
import { NativeSelect } from '@/components/NativeSelect';
import { Button } from '@/components/ui/button';
import type { Dashboard } from '@/domain/config/dashboard';
import { rowGroupOf } from '@/domain/config/groups';
import type { MatchTest } from '@/domain/config/matchTest';
import type { Row } from '@/domain/config/row';
import type { EngineProviders } from '@/engine';

import { discoverBranches } from './branches';
import { removeRow, rowFromRepo } from './edit';
import { CommitInput, GroupControl, OverrideFields } from './fields';
import {
  deleteRowGroup,
  dropRow,
  hasOverrides,
  renameRowGroup,
  reorderRows,
  setRowGroup,
  setRowGroupCredential,
  setRowGroupOverride,
  setRowOverride,
  stepRow,
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
  draft?:
    | { rowId: string; test: MatchTest }
    | { rowId: string; overrideBranch: string };
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
        onDrop={(from, to) => {
          onChange(dropRow(dashboard, from.id, to.id));
        }}
        onStep={(r, delta) => {
          const next = stepRow(dashboard, r.id, delta);
          return next
            ? () => {
                onChange(next);
              }
            : undefined;
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
                draft={
                  draft?.rowId === row.id && 'test' in draft
                    ? draft.test
                    : undefined
                }
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
                      providers={providers}
                      groupId={group.id}
                      onChange={onChange}
                    />
                  )}
                  {draft?.rowId === row.id && 'overrideBranch' in draft && (
                    <OverrideFix
                      dashboard={dashboard}
                      rowId={row.id}
                      branch={draft.overrideBranch}
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
                    loadBranches={() =>
                      discoverBranches(dashboard, providers, [row])
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
  providers,
  groupId,
  onChange,
}: {
  dashboard: Dashboard;
  providers: EngineProviders;
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
        loadBranches={() =>
          discoverBranches(
            dashboard,
            providers,
            dashboard.rows.filter((r) => group.memberIds.includes(r.id)),
          )
        }
        onChange={(stageId, pattern) => {
          onChange(setRowGroupOverride(dashboard, groupId, stageId, pattern));
        }}
      />
    </div>
  );
}

/** *Add override* from an unmapped run (C-15): use the run's branch as a
 * stage's pattern for this row or its row group. */
function OverrideFix({
  dashboard,
  rowId,
  branch,
  onChange,
}: {
  dashboard: Dashboard;
  rowId: string;
  branch: string;
  onChange: (dashboard: Dashboard) => void;
}): React.JSX.Element {
  const group = rowGroupOf(dashboard.rowGroups, rowId);
  const [stageId, setStageId] = useState(dashboard.stages[0]?.id ?? '');
  const [scope, setScope] = useState<'row' | 'group'>('row');
  return (
    <div
      role="group"
      aria-label={`Override for ${branch}`}
      className="flex flex-wrap items-center gap-1 rounded border border-status-started p-1 text-xs"
    >
      <span>
        Use <code>{branch}</code> for
      </span>
      <NativeSelect
        aria-label="Stage to override"
        className="h-7 px-1"
        value={stageId}
        onChange={(e) => {
          setStageId(e.target.value);
        }}
      >
        {dashboard.stages.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </NativeSelect>
      <span>on</span>
      <NativeSelect
        aria-label="Override scope"
        className="h-7 px-1"
        value={scope}
        onChange={(e) => {
          setScope(e.target.value === 'group' ? 'group' : 'row');
        }}
      >
        <option value="row">this row</option>
        {group && <option value="group">its group {group.label ?? ''}</option>}
      </NativeSelect>
      <Button
        size="sm"
        disabled={!stageId}
        onClick={() => {
          onChange(
            scope === 'group' && group
              ? setRowGroupOverride(dashboard, group.id, stageId, branch)
              : setRowOverride(dashboard, rowId, stageId, branch),
          );
        }}
      >
        Apply
      </Button>
    </div>
  );
}
