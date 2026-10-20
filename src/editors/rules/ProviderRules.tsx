/**
 * A rule per source (spec.md A§4.3.7): stage rules, and the row rules of a
 * row group or the dashboard, are set per source because GitHub and
 * Amplify records have different keys. Collapsed until opened, counting
 * the rules set; an empty rule unsets it (inheriting from the level
 * above).
 *
 * @module
 */
import { Disclosure } from '@/components/Disclosure';
import {
  type Provider,
  PROVIDER_LABELS,
  PROVIDERS,
} from '@/domain/config/providers';
import { always, unlessAlways } from '@/domain/rules/always';
import type { Rule } from '@/domain/rules/schema';

import { RuleEditor } from './RuleEditor';

export function ProviderRules({
  title,
  rules,
  onChange,
  scope = 'record',
  newPath,
  providers = PROVIDERS,
  target,
  defaultOpen,
}: {
  title: string;
  rules: Partial<Record<Provider, Rule | undefined>>;
  onChange: (provider: Provider, rule: Rule | undefined) => void;
  scope?: 'record' | 'item';
  newPath?: string;
  /** The sources to offer (item rules: only sources with items). */
  providers?: readonly Provider[];
  /** Its editor-item key; each source's rule is `<target>:<source>`. */
  target?: string;
  /** Open from the start (inside a section that was itself opened). */
  defaultOpen?: boolean;
}): React.JSX.Element {
  const set = providers.filter((p) => rules[p] !== undefined).length;
  return (
    <Disclosure
      title={title}
      count={set}
      target={target}
      defaultOpen={defaultOpen}
      className="rounded-md border px-2 py-1"
      contentClassName="flex flex-col gap-2 py-1"
    >
      {providers.map((p) => (
        <div key={p} className="flex flex-col gap-1">
          <span className="font-semibold">{PROVIDER_LABELS[p]}</span>
          <RuleEditor
            label={`${title}: ${PROVIDER_LABELS[p]}`}
            provider={p}
            scope={scope}
            newPath={newPath}
            target={target === undefined ? undefined : `${target}:${p}`}
            rule={rules[p] ?? always}
            onChange={(rule) => {
              onChange(p, unlessAlways(rule));
            }}
          />
        </div>
      ))}
    </Disclosure>
  );
}
