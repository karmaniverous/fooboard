/**
 * Status-set choices for a row group, a row and its single cells (spec.md
 * A§4.3.6). Each offers the provider's sets, or *inherit*, naming the set
 * it would inherit.
 *
 * @module
 */
import { Fragment } from 'react';

import { Choice } from '@/components/Choice';
import { Disclosure } from '@/components/Disclosure';
import type { Dashboard } from '@/domain/config/dashboard';
import type { RowGroup } from '@/domain/config/groups';
import {
  type Provider,
  PROVIDER_LABELS,
  PROVIDERS,
} from '@/domain/config/providers';
import type { Row } from '@/domain/config/row';
import { findStatusSet, inheritedStatusSetId } from '@/domain/statuses/resolve';

import {
  setCellStatusSet,
  setGroupStatusSet,
  setRowStatusSet,
} from './overrideSets';
import { setOptions } from './statusSetOptions';

const nameOf = (dashboard: Dashboard, id: string) =>
  findStatusSet(id, dashboard.customStatusSets)?.name ?? id;

/** The provider's sets, after an *inherit* option naming `inherited`. */
const withInherit = (
  dashboard: Dashboard,
  provider: Provider,
  inherited: string,
) => [
  { value: '', label: `Inherit (${nameOf(dashboard, inherited)})` },
  ...setOptions(dashboard, provider),
];

const PROVIDER_OPTIONS = PROVIDERS.map((p) => [p, PROVIDER_LABELS[p]] as const);

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
      {PROVIDER_OPTIONS.map(([provider, noun]) => (
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
  const inherited = inheritedStatusSetId(dashboard, row);
  const forCells = row.statusSet ?? inherited;
  const count =
    (row.statusSet ? 1 : 0) + Object.keys(row.cellStatusSets).length;
  return (
    <Disclosure
      title="Status sets"
      count={count}
      contentClassName="grid grid-cols-[auto_1fr] items-center gap-1"
    >
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
    </Disclosure>
  );
}
