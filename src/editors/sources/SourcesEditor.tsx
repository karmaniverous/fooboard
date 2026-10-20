/**
 * The Sources tab (spec.md A§4.3.7): the source rule each source uses,
 * from the built-ins and the dashboard's own. *Customise* copies the
 * chosen rule into one the dashboard owns, to edit: which records to keep
 * and what the reader asks for (keys and items are edited from the
 * record's raw data). Problems fixed here (translation problems, window
 * hints) are listed at the top.
 *
 * @module
 */
import { Choice } from '@/components/Choice';
import { Button } from '@/components/ui/button';
import type { Dashboard } from '@/domain/config/dashboard';
import {
  type Provider,
  PROVIDER_LABELS,
  PROVIDERS,
} from '@/domain/config/providers';
import { BUILTIN_SOURCES } from '@/domain/model/builtinSources';
import type { Problem } from '@/domain/problems/problem';

import {
  chooseSource,
  customiseSource,
  removeSource,
  sourceInUse,
  updateSource,
} from './customSource';
import { CustomSourceEditor } from './CustomSourceEditor';

const optionsFor = (dashboard: Dashboard, provider: Provider) =>
  [...BUILTIN_SOURCES, ...dashboard.customSourceRules]
    .filter((s) => s.provider === provider)
    .map((s) => ({ value: s.id, label: s.name }));

export function SourcesEditor({
  dashboard,
  onChange,
  hints = [],
}: {
  dashboard: Dashboard;
  onChange: (dashboard: Dashboard) => void;
  /** Problems fixed on this tab (window hints, translation problems). */
  hints?: readonly Problem[];
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-3 text-sm">
      <p className="text-xs text-muted-foreground">
        A source rule turns a source&apos;s data into records the other rules
        test.
      </p>
      {hints.length > 0 && (
        <ul
          aria-label="Source problems"
          className="flex flex-col gap-1 rounded-md border border-status-started p-2 text-xs"
        >
          {hints.map((h) => (
            <li key={h.id}>{h.message}</li>
          ))}
        </ul>
      )}
      {PROVIDERS.map((provider) => {
        const label = PROVIDER_LABELS[provider];
        return (
          <label
            key={provider}
            className="flex items-center gap-2"
            data-edit-target={`source-choice:${provider}`}
          >
            <span className="w-20">{label}</span>
            <Choice
              label={`${label} source rule`}
              value={dashboard.sourceRules[provider]}
              options={optionsFor(dashboard, provider)}
              onValueChange={(id) => {
                onChange(chooseSource(dashboard, provider, id));
              }}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                onChange(
                  customiseSource(dashboard, dashboard.sourceRules[provider]),
                );
              }}
            >
              Customise
            </Button>
          </label>
        );
      })}
      {dashboard.customSourceRules.map((rule) => (
        <CustomSourceEditor
          key={rule.id}
          rule={rule}
          chosen={dashboard.sourceRules[rule.provider] === rule.id}
          onChange={(next) => {
            onChange(updateSource(dashboard, next));
          }}
          onRemove={
            sourceInUse(dashboard, rule.id)
              ? undefined
              : () => {
                  onChange(removeSource(dashboard, rule.id));
                }
          }
        />
      ))}
    </div>
  );
}
