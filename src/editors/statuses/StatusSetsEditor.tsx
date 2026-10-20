/**
 * The dashboard's status sets (spec.md A§4.3.6): the set each provider's
 * cells use unless a row group, row or cell chooses another, from the
 * bundled presets and the dashboard's own sets. *Customise* copies the
 * chosen set into one the dashboard owns, to edit.
 *
 * @module
 */
import { Choice } from '@/components/Choice';
import { Button } from '@/components/ui/button';
import type { Dashboard } from '@/domain/config/dashboard';
import { PROVIDER_LABELS, PROVIDERS } from '@/domain/config/providers';
import { targetKey } from '@/editors/editTarget';
import { useAccordion } from '@/editors/useAccordion';

import { customise, removeSet, setInUse, updateSet } from './customSet';
import { CustomSetEditor } from './CustomSetEditor';
import { setDashboardStatusSet } from './overrideSets';
import { setOptions } from './statusSetOptions';
import { addStatusFor, type UnknownCell } from './unknownRuns';
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
  const accordion = useAccordion(
    dashboard.customStatusSets.map((s) => ({
      key: s.id,
      targets: [targetKey({ kind: 'statusSet', id: s.id })],
    })),
  );
  return (
    <div className="flex flex-col gap-3 text-sm">
      <p className="text-xs text-muted-foreground">
        A status set decides which jobs count and what status a cell shows: the
        first status whose test matches.
      </p>
      {PROVIDER_OPTIONS.map(({ provider, label }) => (
        <label
          key={provider}
          className="flex items-center gap-2"
          data-edit-target={targetKey({
            kind: 'dashboard',
            part: 'statusSets',
          })}
        >
          <span className="w-20">{label}</span>
          <Choice
            label={`${label} status set`}
            value={dashboard.statusSets[provider]}
            options={setOptions(dashboard, provider)}
            onValueChange={(id) => {
              onChange(setDashboardStatusSet(dashboard, provider, id));
            }}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              onChange(customise(dashboard, dashboard.statusSets[provider]));
            }}
          >
            Customise
          </Button>
        </label>
      ))}
      <UnknownRunsList
        unknown={unknown}
        onAddStatus={(c) => {
          onChange(addStatusFor(dashboard, c));
        }}
      />
      {dashboard.customStatusSets.map((set) => (
        <CustomSetEditor
          key={set.id}
          set={set}
          item={accordion.itemProps(set.id)}
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
