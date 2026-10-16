/**
 * Dashboard-wide settings: the mapping rules (spec.md §4.3.1: phase tests
 * and the workflow filter) and the status colours.
 *
 * @module
 */
import { STATUS_META } from '@/board/cellView';
import { Button } from '@/components/ui/button';
import {
  DEFAULT_STATUS_COLORS,
  type StatusColors,
} from '@/domain/config/colors';
import type { Dashboard } from '@/domain/config/dashboard';

import { MatchTestsEditor } from './MatchTestsEditor';

export function MappingEditor({
  dashboard,
  onChange,
}: {
  dashboard: Dashboard;
  onChange: (dashboard: Dashboard) => void;
}): React.JSX.Element {
  const { mapping } = dashboard;
  const set = (next: Dashboard['mapping']) => {
    onChange({ ...dashboard, mapping: next });
  };
  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-muted-foreground">
        A job matching a deploy test is the deploy phase; one matching a test
        test is the test phase (a job matching both counts as test). Tests
        ignore case.
      </p>
      <MatchTestsEditor
        title="Deploy phase tests"
        fields={['jobName']}
        tests={mapping.phases.deploy}
        onChange={(deploy) => {
          set({ ...mapping, phases: { ...mapping.phases, deploy } });
        }}
      />
      <MatchTestsEditor
        title="Test phase tests"
        fields={['jobName']}
        tests={mapping.phases.test}
        onChange={(test) => {
          set({ ...mapping, phases: { ...mapping.phases, test } });
        }}
      />
      <MatchTestsEditor
        title="Only workflows matching"
        fields={['workflowName']}
        tests={mapping.workflowFilter.include}
        onChange={(include) => {
          set({
            ...mapping,
            workflowFilter: { ...mapping.workflowFilter, include },
          });
        }}
      />
      <MatchTestsEditor
        title="Except workflows matching"
        fields={['workflowName']}
        tests={mapping.workflowFilter.exclude}
        onChange={(exclude) => {
          set({
            ...mapping,
            workflowFilter: { ...mapping.workflowFilter, exclude },
          });
        }}
      />
    </div>
  );
}

export function ColorsEditor({
  dashboard,
  onChange,
}: {
  dashboard: Dashboard;
  onChange: (dashboard: Dashboard) => void;
}): React.JSX.Element {
  const colors = dashboard.statusColors;
  const keys = Object.keys(DEFAULT_STATUS_COLORS) as (keyof StatusColors)[];
  return (
    <div className="flex flex-col gap-2 text-sm">
      {keys.map((k) => (
        <label key={k} className="flex items-center gap-2">
          <input
            type="color"
            aria-label={`${STATUS_META[k].label} colour`}
            value={colors[k]}
            onChange={(e) => {
              onChange({
                ...dashboard,
                statusColors: { ...colors, [k]: e.target.value },
              });
            }}
          />
          {STATUS_META[k].label}
        </label>
      ))}
      <Button
        size="sm"
        variant="outline"
        className="self-start"
        onClick={() => {
          onChange({
            ...dashboard,
            statusColors: { ...DEFAULT_STATUS_COLORS },
          });
        }}
      >
        Reset colours
      </Button>
    </div>
  );
}
