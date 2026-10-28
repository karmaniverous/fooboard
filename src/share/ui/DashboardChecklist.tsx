/**
 * Choosing dashboards to export or import (spec.md §3.8): a checkbox per
 * dashboard and *Select all*, each with room for more (the import's
 * same-id choice).
 *
 * @module
 */
import { CheckField } from '@/components/CheckField';
import type { Dashboard } from '@/domain/config/dashboard';

export function DashboardChecklist({
  label,
  dashboards,
  selected,
  onSelectedChange,
  extra,
}: {
  /** The list's accessible name. */
  label: string;
  dashboards: readonly Dashboard[];
  selected: ReadonlySet<string>;
  onSelectedChange: (selected: Set<string>) => void;
  /** More controls for a selected dashboard. */
  extra?: (dashboard: Dashboard) => React.ReactNode;
}): React.JSX.Element {
  const all = dashboards.every((d) => selected.has(d.id));
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="sr-only">{label}</legend>
      {dashboards.length > 1 && (
        <CheckField
          label="Select all"
          checked={all}
          onCheckedChange={(on) => {
            onSelectedChange(new Set(on ? dashboards.map((d) => d.id) : []));
          }}
          className="text-sm"
        />
      )}
      <ul aria-label={label} className="flex flex-col gap-1.5">
        {dashboards.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center gap-2">
            <CheckField
              label={d.name}
              checked={selected.has(d.id)}
              onCheckedChange={(on) => {
                const next = new Set(selected);
                if (on) next.add(d.id);
                else next.delete(d.id);
                onSelectedChange(next);
              }}
              className="text-sm"
            />
            {selected.has(d.id) && extra?.(d)}
          </li>
        ))}
      </ul>
    </fieldset>
  );
}
