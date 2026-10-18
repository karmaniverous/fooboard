/**
 * The dashboard's status sets (spec.md A§4.3.6): the set each provider's
 * cells use unless a row group, row or cell chooses another, from the
 * bundled presets and the dashboard's own sets.
 *
 * @module
 */
import { Choice } from '@/components/Choice';
import type { Dashboard } from '@/domain/config/dashboard';
import type { StatusProvider } from '@/domain/config/statusSets';

import { setOptions } from './statusSetOptions';

const PROVIDERS: { provider: StatusProvider; label: string }[] = [
  { provider: 'github', label: 'GitHub' },
  { provider: 'amplify', label: 'Amplify' },
];

export function StatusSetsEditor({
  dashboard,
  onChange,
}: {
  dashboard: Dashboard;
  onChange: (dashboard: Dashboard) => void;
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
        </label>
      ))}
    </div>
  );
}
