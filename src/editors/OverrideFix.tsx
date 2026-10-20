/**
 * *Add override* from an unmapped record (spec.md C-15, A§4.3.7): use the
 * record's branch as a stage's pattern for a row or row group. Every row
 * reading the record's repo or app is offered (with its group), since the
 * one the editor opened on may not be the row whose rules pick the
 * record.
 *
 * @module
 */
import { useState } from 'react';

import { Choice } from '@/components/Choice';
import { Button } from '@/components/ui/button';
import type { Dashboard } from '@/domain/config/dashboard';
import { groupOf } from '@/domain/config/groups';

import { setRowGroupOverride, setRowOverride } from './overrideEdit';

export function OverrideFix({
  dashboard,
  onChange,
  rowIds,
  branch,
}: {
  dashboard: Dashboard;
  onChange: (dashboard: Dashboard) => void;
  /** The rows reading the record's repo or app, the first preselected. */
  rowIds: readonly string[];
  branch: string;
}): React.JSX.Element {
  const [stageId, setStageId] = useState(dashboard.stages[0]?.id ?? '');
  const targets = dashboard.rows
    .filter((r) => rowIds.includes(r.id))
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
  const [target, setTarget] = useState(`row:${rowIds[0] ?? ''}`);
  return (
    <div
      role="group"
      aria-label={`Override for ${branch}`}
      data-edit-target={`row:${rowIds[0] ?? ''}:override`}
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
