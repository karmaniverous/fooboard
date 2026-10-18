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

import { Choice } from '@/components/Choice';
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
        <OverrideFix {...props} row={row} branch={overrideBranch} />
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
 * stage's pattern for a row or row group. Every GitHub row reading the
 * run's repo is offered (with its group), since the one the editor opened
 * on may not be the row whose key tests pick the run's jobs. */
function OverrideFix({
  dashboard,
  onChange,
  row,
  branch,
}: Props & {
  row: Row;
  branch: string;
}): React.JSX.Element {
  const [stageId, setStageId] = useState(dashboard.stages[0]?.id ?? '');
  const targets = dashboard.rows
    .filter((r) => r.type === 'github' && r.repo === row.repo)
    .flatMap((r) => {
      const g = groupOf(dashboard.rowGroups, r.id);
      return [
        { value: `row:${r.id}`, label: `row ${r.displayName}` },
        ...(g
          ? [{ value: `group:${g.id}`, label: `group ${g.label ?? g.id}` }]
          : []),
      ];
    })
    .filter((t, i, all) => all.findIndex((u) => u.value === t.value) === i);
  const [target, setTarget] = useState(`row:${row.id}`);
  return (
    <div
      role="group"
      aria-label={`Override for ${branch}`}
      className="flex flex-wrap items-center gap-1 rounded border border-status-started p-1 text-xs"
    >
      <span>
        Use <code>{branch}</code> for
      </span>
      <Choice
        label="Stage to override"
        className="h-7"
        value={stageId}
        options={dashboard.stages.map((s) => ({ value: s.id, label: s.name }))}
        onValueChange={setStageId}
      />
      <span>on</span>
      <Choice
        label="Override scope"
        className="h-7"
        value={target}
        options={targets}
        onValueChange={setTarget}
      />
      <Button
        size="sm"
        disabled={!stageId}
        onClick={() => {
          const [kind, id = ''] = target.split(/:(.*)/s);
          onChange(
            kind === 'group'
              ? setRowGroupOverride(dashboard, id, stageId, branch)
              : setRowOverride(dashboard, id, stageId, branch),
          );
        }}
      >
        Apply
      </Button>
    </div>
  );
}
