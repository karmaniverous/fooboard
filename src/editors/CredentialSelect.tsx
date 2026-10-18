/**
 * A credential choice for a row, an Amplify source or a row group
 * (spec.md C-1a): inherit, or pick one of the dashboard's credentials.
 *
 * @module
 */
import { NativeSelect } from '@/components/NativeSelect';
import type { CredentialKind } from '@/domain/config/credentials';
import type { Dashboard } from '@/domain/config/dashboard';

const NOUN: Record<CredentialKind, string> = {
  github: 'GitHub token',
  aws: 'AWS key',
};

/** Where an unset choice comes from, and what it resolves to. */
export interface Inherited {
  from: 'group' | 'dashboard';
  id?: string;
}

/** A credential choice, captioned with its kind: the inherited default
 * (named, with where it comes from), or one of the dashboard's
 * credentials of that kind. */
export function CredentialSelect({
  dashboard,
  kind,
  value,
  onChange,
  label,
  inherited = { from: 'dashboard', id: dashboard.defaultCredentials[kind] },
}: {
  dashboard: Dashboard;
  kind: CredentialKind;
  value: string | undefined;
  onChange: (id: string | undefined) => void;
  /** The accessible name, e.g. "GitHub token for api". */
  label: string;
  /** What leaving it unset means (C-1a); the dashboard default if omitted. */
  inherited?: Inherited;
}): React.JSX.Element {
  const options = dashboard.credentials.filter((c) => c.kind === kind);
  const named = options.find((c) => c.id === inherited.id)?.label;
  const source = inherited.from === 'group' ? "group's" : "dashboard's";
  return (
    <label className="flex flex-wrap items-center gap-1 text-xs">
      <span className="text-muted-foreground">{NOUN[kind]}</span>
      <NativeSelect
        aria-label={label}
        className="h-8 px-1 text-xs"
        value={value ?? ''}
        onChange={(e) => {
          onChange(e.target.value || undefined);
        }}
      >
        <option value="">
          {named
            ? `${named} (the ${source} default)`
            : `None (the ${source} default is not set)`}
        </option>
        {options.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </NativeSelect>
    </label>
  );
}
