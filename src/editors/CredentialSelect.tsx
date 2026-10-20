/**
 * A credential choice for a row, an Amplify source or a row group
 * (spec.md C-1a): inherit, or pick one of the dashboard's credentials.
 *
 * @module
 */
import { Choice } from '@/components/Choice';
import { sortCredentials } from '@/credentials/credentialOrder';
import type { CredentialKind } from '@/domain/config/credentials';
import type { Dashboard } from '@/domain/config/dashboard';

const NOUN: Record<CredentialKind, string> = {
  github: 'GitHub token',
  aws: 'AWS key',
};

/** Where a default comes from, as the first option names it. */
const LEVEL: Record<Inherited['from'], string> = {
  group: 'Group',
  dashboard: 'Dashboard',
};
const OWNER: Record<Inherited['from'], string> = {
  group: "group's",
  dashboard: "dashboard's",
};

/** Where an unset choice comes from, and what it resolves to. */
export interface Inherited {
  from: 'group' | 'dashboard';
  id?: string;
}

/** A credential choice, captioned with its kind: the inherited default
 * (where it comes from, then its name), or one of the dashboard's other
 * credentials of that kind, by name. Each credential is listed once: the
 * inherited one only as the default, unless it is also the current value
 * (pinned to the credential that is now the default), so the selection
 * always shows. */
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
  const credentials = sortCredentials(
    dashboard.credentials.filter((c) => c.kind === kind),
  );
  const named = credentials.find((c) => c.id === inherited.id)?.label;
  const plain = credentials.filter(
    (c) => c.id !== inherited.id || c.id === value,
  );
  // A value naming no credential (not expected: removing one clears its
  // references) still gets an option, so the choice never shows blank.
  const missing =
    value && !credentials.some((c) => c.id === value)
      ? [{ value, label: `${value} (not on this dashboard)` }]
      : [];
  return (
    <label className="flex flex-wrap items-center gap-1 text-xs">
      <span className="text-muted-foreground">{NOUN[kind]}</span>
      <Choice
        label={label}
        className="h-8 text-xs"
        value={value ?? ''}
        options={[
          {
            value: '',
            label: named
              ? `${LEVEL[inherited.from]} default (${named})`
              : `None (the ${OWNER[inherited.from]} default is not set)`,
          },
          ...plain.map((c) => ({ value: c.id, label: c.label })),
          ...missing,
        ]}
        onValueChange={(v) => {
          onChange(v || undefined);
        }}
      />
    </label>
  );
}
