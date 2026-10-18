/**
 * Dashboard-wide mapping rules (spec.md §4.3.1): the workflow filter. Which
 * jobs count, and what status they show, is the status sets' (A§4.3.6).
 *
 * @module
 */
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
