/**
 * Status-set choices for a row group, a row and its single cells (spec.md
 * A§4.3.6). Each offers the provider's sets, or *inherit*, naming the set
 * it would inherit.
 *
 * @module
 */
import { ChevronRight } from 'lucide-react';
import { Fragment } from 'react';

import { Choice } from '@/components/Choice';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import type { Dashboard } from '@/domain/config/dashboard';
import type { RowGroup } from '@/domain/config/groups';
import type { Row } from '@/domain/config/row';
import type { StatusProvider } from '@/domain/config/statusSets';
import { findStatusSet } from '@/domain/statuses/resolve';

import { setOptions } from '../statusSetOptions';
import {
  rowInherits,
  setCellStatusSet,
  setGroupStatusSet,
  setRowStatusSet,
} from './overrideSets';

const nameOf = (dashboard: Dashboard, id: string) =>
  findStatusSet(id, dashboard.customStatusSets)?.name ?? id;

/** The provider's sets, after an *inherit* option naming `inherited`. */
const withInherit = (
  dashboard: Dashboard,
  provider: StatusProvider,
  inherited: string,
) => [
  { value: '', label: `Inherit (${nameOf(dashboard, inherited)})` },
  ...setOptions(dashboard, provider),
];

const PROVIDERS = [
  ['github', 'GitHub'],
  ['amplify', 'Amplify'],
] as const;

export function GroupStatusSets({
  dashboard,
  group,
  name,
  onChange,
}: {
  dashboard: Dashboard;
  group: RowGroup;
  name: string;
  onChange: (dashboard: Dashboard) => void;
}): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {PROVIDERS.map(([provider, noun]) => (
        <Choice
          key={provider}
          label={`${noun} status set for ${name}`}
          value={group.statusSets[provider] ?? ''}
          options={withInherit(
            dashboard,
            provider,
            dashboard.statusSets[provider],
          )}
          onValueChange={(id) => {
            onChange(setGroupStatusSet(dashboard, group.id, provider, id));
          }}
        />
      ))}
    </div>
  );
}

export function RowStatusSets({
  dashboard,
  row,
  onChange,
}: {
  dashboard: Dashboard;
  row: Row;
  onChange: (dashboard: Dashboard) => void;
}): React.JSX.Element {
  const inherited = rowInherits(dashboard, row);
  const forCells = row.statusSet ?? inherited;
  const count =
    (row.statusSet ? 1 : 0) + Object.keys(row.cellStatusSets).length;
  return (
    <Collapsible className="flex flex-col gap-1 text-xs">
      <CollapsibleTrigger className="flex items-center gap-1 self-start rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&[data-state=open]>svg]:rotate-90">
        <ChevronRight aria-hidden className="size-3 transition-transform" />
        Status sets{count > 0 ? ` (${String(count)})` : ''}
      </CollapsibleTrigger>
      <CollapsibleContent className="grid grid-cols-[auto_1fr] items-center gap-1">
        <span>Row</span>
        <Choice
          label={`Status set for ${row.displayName}`}
          value={row.statusSet ?? ''}
          options={withInherit(dashboard, row.type, inherited)}
          onValueChange={(id) => {
            onChange(setRowStatusSet(dashboard, row.id, id));
          }}
        />
        {dashboard.stages.map((s) => (
          <Fragment key={s.id}>
            <span>{s.name}</span>
            <Choice
              label={`${s.name} status set for ${row.displayName}`}
              value={row.cellStatusSets[s.id] ?? ''}
              options={withInherit(dashboard, row.type, forCells)}
              onValueChange={(id) => {
                onChange(setCellStatusSet(dashboard, row.id, s.id, id));
              }}
            />
          </Fragment>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}
