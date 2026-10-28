/**
 * The dashboard's status sets (spec.md A§4.3.6, §3.11): which set each
 * provider's cells use by default and where that is chosen (the
 * dashboard's *Settings* on the General tab; any level's settings may
 * choose another), *Customise* to copy it into a set the dashboard owns
 * to edit, the board's runs no status matches, and the dashboard's own
 * sets.
 *
 * @module
 */
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import type { Dashboard } from '@/domain/config/dashboard';
import { PROVIDER_LABELS, PROVIDERS } from '@/domain/config/providers';
import { DEFAULT_STATUS_SET_IDS } from '@/domain/config/statusSets';
import { readSetting } from '@/domain/settings/schema';
import { findStatusSet } from '@/domain/statuses/resolve';
import { targetKey } from '@/editors/editTarget';
import { type OpenRequest, useAccordion } from '@/editors/useAccordion';

import { customise, removeSet, setInUse, updateSet } from './customSet';
import { CustomSetEditor } from './CustomSetEditor';
import { addStatusWhere, type UnknownCell } from './unknownRuns';
import { UnknownRunsList } from './UnknownRunsList';

const PROVIDER_OPTIONS = PROVIDERS.map((provider) => ({
  provider,
  label: PROVIDER_LABELS[provider],
}));

export function StatusSetsEditor({
  dashboard,
  onChange,
  unknown = [],
}: {
  dashboard: Dashboard;
  onChange: (dashboard: Dashboard) => void;
  /** The board's cells whose run matched no status. */
  unknown?: readonly UnknownCell[];
}): React.JSX.Element {
  // A status added for an Unknown run opens, with its set.
  const [opened, setOpened] = useState<{
    set: OpenRequest;
    status: OpenRequest;
  }>();
  const accordion = useAccordion(
    dashboard.customStatusSets.map((s) => ({
      key: s.id,
      targets: [targetKey({ kind: 'statusSet', id: s.id })],
    })),
    opened?.set,
  );
  return (
    <div className="flex flex-col gap-3 text-sm">
      <p className="text-xs text-muted-foreground">
        A status set decides which jobs count and what status a cell shows: the
        first status whose test matches.
      </p>
      {PROVIDER_OPTIONS.map(({ provider, label }) => {
        const own = readSetting(dashboard.settings, 'statusSets', provider);
        const id = own ?? DEFAULT_STATUS_SET_IDS[provider];
        const name = findStatusSet(id, dashboard.customStatusSets)?.name ?? id;
        return (
          <div
            key={provider}
            className="flex flex-wrap items-center gap-2"
            data-edit-target="dashboard:statusSets"
          >
            <span className="w-20">{label}</span>
            <span>{own ? name : `Built-in (${name})`}</span>
            <span className="text-xs text-muted-foreground">
              Chosen in Settings on the General tab; a group, row, column or
              cell may choose another in its settings.
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                onChange(customise(dashboard, id));
              }}
            >
              Customise
            </Button>
          </div>
        );
      })}
      <UnknownRunsList
        unknown={unknown}
        onAddStatus={(c) => {
          const added = addStatusWhere(dashboard, c);
          const { setId, statusId } = added;
          if (setId !== undefined && statusId !== undefined)
            setOpened({ set: { key: setId }, status: { key: statusId } });
          onChange(added.dashboard);
        }}
      />
      {dashboard.customStatusSets.map((set) => (
        <CustomSetEditor
          key={set.id}
          set={set}
          item={accordion.itemProps(set.id)}
          openStatus={opened?.set.key === set.id ? opened.status : undefined}
          onChange={(next) => {
            onChange(updateSet(dashboard, set.id, () => next));
          }}
          onRemove={
            setInUse(dashboard, set.id)
              ? undefined
              : () => {
                  onChange(removeSet(dashboard, set.id));
                }
          }
        />
      ))}
    </div>
  );
}
