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
import type { StatusProvider } from '@/domain/config/statusSets';

import {
  customise,
  removeSet,
  setInUse,
  updateSet,
} from './statuses/customSet';
import { CustomSetEditor } from './statuses/CustomSetEditor';
import { addStatusFor, type UnknownCell } from './statuses/unknownRuns';
import { setOptions } from './statusSetOptions';

const PROVIDERS: { provider: StatusProvider; label: string }[] = [
  { provider: 'github', label: 'GitHub' },
  { provider: 'amplify', label: 'Amplify' },
];

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
  return (
    <div className="flex flex-col gap-3 text-sm">
      <p className="text-xs text-muted-foreground">
        A status set decides which jobs count and what status a cell shows: the
        first status whose test matches.
      </p>
      {PROVIDERS.map(({ provider, label }) => (
        <label key={provider} className="flex items-center gap-2">
          <span className="w-20">{label}</span>
          <Choice
            label={`${label} status set`}
            value={dashboard.statusSets[provider]}
            options={setOptions(dashboard, provider)}
            onValueChange={(id) => {
              onChange({
                ...dashboard,
                statusSets: { ...dashboard.statusSets, [provider]: id },
              });
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
      {unknown.length > 0 && (
        <section
          aria-label="Runs no status matches"
          className="flex flex-col gap-2 rounded border border-dashed p-2"
        >
          <h4 className="text-xs font-semibold">
            Runs no status matches ({unknown.length})
          </h4>
          {unknown.map((c) => (
            <div
              key={`${c.rowId}/${c.stageId}`}
              className="flex flex-col gap-1"
            >
              <div className="flex items-center justify-between gap-2">
                <span>
                  {c.rowName} &middot; {c.stageName} ({c.setName})
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  aria-label={`Add status for ${c.rowName} ${c.stageName}`}
                  onClick={() => {
                    onChange(addStatusFor(dashboard, c));
                  }}
                >
                  Add status
                </Button>
              </div>
              <pre className="max-h-32 overflow-auto rounded bg-muted p-1 text-[0.7rem]">
                {JSON.stringify(c.document, null, 2)}
              </pre>
            </div>
          ))}
        </section>
      )}
      {dashboard.customStatusSets.map((set) => (
        <CustomSetEditor
          key={set.id}
          set={set}
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
