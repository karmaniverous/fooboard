/**
 * A rule per source (spec.md A§4.3.7): stage rules, and the row rules of a
 * row group or the dashboard, are set per source because GitHub and
 * Amplify records have different keys. Collapsed until opened, counting
 * the rules set; an empty rule unsets it (inheriting from the level
 * above).
 *
 * @module
 */
import { PROVIDER_LABELS, STATUS_PROVIDERS } from '@/domain/config/statusSets';
import type { Rule } from '@/domain/rules/schema';

import { RuleEditor } from './RuleEditor';

type Provider = (typeof STATUS_PROVIDERS)[number];

export function ProviderRules({
  title,
  rules,
  onChange,
  scope = 'record',
  newPath,
  providers = STATUS_PROVIDERS,
}: {
  title: string;
  rules: Partial<Record<Provider, Rule | undefined>>;
  onChange: (provider: Provider, rule: Rule | undefined) => void;
  scope?: 'record' | 'item';
  newPath?: string;
  /** The sources to offer (item rules: only sources with items). */
  providers?: readonly Provider[];
}): React.JSX.Element {
  const set = providers.filter((p) => rules[p] !== undefined).length;
  return (
    <details className="rounded-md border px-2 py-1 text-xs">
      <summary className="cursor-pointer select-none">
        {title}
        {set > 0 ? ` (${String(set)})` : ''}
      </summary>
      <div className="flex flex-col gap-2 py-1">
        {providers.map((p) => (
          <div key={p} className="flex flex-col gap-1">
            <span className="font-semibold">{PROVIDER_LABELS[p]}</span>
            <RuleEditor
              label={`${title}: ${PROVIDER_LABELS[p]}`}
              provider={p}
              scope={scope}
              newPath={newPath}
              rule={rules[p] ?? { combine: 'and', checks: [] }}
              onChange={(rule) => {
                onChange(p, rule.checks.length > 0 ? rule : undefined);
              }}
            />
          </div>
        ))}
      </div>
    </details>
  );
}
