/**
 * A row's group and overrides in the row editor (spec.md C-14b, C-14c,
 * C-1a, C-15): its group; its group's default credentials and
 * branch-pattern overrides (shown on each member, since a group has no
 * editor of its own); *Add override* from an unmapped run; and the row's
 * own overrides.
 *
 * @module
 */
import { useState } from 'react';

import { NativeSelect } from '@/components/NativeSelect';
import { Button } from '@/components/ui/button';
import type { Dashboard } from '@/domain/config/dashboard';
import { groupOf, type RowGroup } from '@/domain/config/groups';
import { effectiveBranchPattern } from '@/domain/config/inheritance';
import type { Row } from '@/domain/config/row';
import type { EngineProviders } from '@/engine';

import { discoverBranches } from './branches';
import { CredentialSelect } from './CredentialSelect';
import { GroupControl } from './GroupControl';
import {
  setRowGroupCredential,
  setRowGroupOverride,
  setRowOverride,
} from './overrideEdit';
import { OverrideFields } from './OverrideFields';

interface Props {
  dashboard: Dashboard;
  providers: EngineProviders;
  onChange: (dashboard: Dashboard) => void;
}

/** Each stage with the pattern it inherits below `group` (or the stage's
 * own pattern for the group itself). */
const inheritedStages = (d: Dashboard, group: RowGroup | undefined) =>
  d.stages.map((s) => ({
    id: s.id,
    name: s.name,
    inherited: effectiveBranchPattern(s, {}, group),
  }));

export function RowGrouping({
  row,
  overrideBranch,
  ...props
}: Props & {
  row: Row;
  /** A branch from an unmapped run to offer as an override. */
  overrideBranch?: string;
}): React.JSX.Element {
  const { dashboard, providers, onChange } = props;
  const group = groupOf(dashboard.rowGroups, row.id);
  return (
    <>
      <GroupControl
        dashboard={dashboard}
        axis="rows"
        itemId={row.id}
        name={row.displayName}
        onChange={onChange}
      />
      {group && <RowGroupSettings {...props} group={group} />}
      {overrideBranch !== undefined && (
        <OverrideFix
          {...props}
          row={row}
          group={group}
          branch={overrideBranch}
        />
      )}
      <OverrideFields
        name={row.displayName}
        stages={inheritedStages(dashboard, group)}
        own={row.branchPatternOverrides}
        loadBranches={() => discoverBranches(dashboard, providers, [row])}
        onChange={(stageId, pattern) => {
          onChange(setRowOverride(dashboard, row.id, stageId, pattern));
        }}
      />
    </>
  );
}

function RowGroupSettings({
  dashboard,
  providers,
  onChange,
  group,
}: Props & { group: RowGroup }): React.JSX.Element {
  const name = group.label ?? 'this group';
  return (
    <div className="flex flex-col gap-1 rounded border border-dashed p-1 text-xs">
      <span className="font-semibold">Group settings: {name}</span>
      <div className="flex flex-wrap items-center gap-1">
        {(
          [
            ['github', 'GitHub token'],
            ['aws', 'AWS key'],
          ] as const
        ).map(([kind, noun]) => (
          <CredentialSelect
            key={kind}
            dashboard={dashboard}
            kind={kind}
            label={`${noun} for ${name}`}
            value={group.defaultCredentials[kind]}
            onChange={(id) => {
              onChange(setRowGroupCredential(dashboard, group.id, kind, id));
            }}
          />
        ))}
      </div>
      <OverrideFields
        name={name}
        stages={inheritedStages(dashboard, undefined)}
        own={group.branchPatternOverrides}
        loadBranches={() =>
          discoverBranches(
            dashboard,
            providers,
            dashboard.rows.filter((r) => group.memberIds.includes(r.id)),
          )
        }
        onChange={(stageId, pattern) => {
          onChange(setRowGroupOverride(dashboard, group.id, stageId, pattern));
        }}
      />
    </div>
  );
}

/** *Add override* from an unmapped run (C-15): use the run's branch as a
 * stage's pattern for this row or its row group. */
function OverrideFix({
  dashboard,
  onChange,
  row,
  group,
  branch,
}: Props & {
  row: Row;
  group: RowGroup | undefined;
  branch: string;
}): React.JSX.Element {
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
              : setRowOverride(dashboard, row.id, stageId, branch),
          );
        }}
      >
        Apply
      </Button>
    </div>
  );
}
