/**
 * A plain credential choice (spec.md C-1a, §3.11): which of the
 * dashboard's credentials of one kind to list with (the repo and app
 * pickers) or a pinned app serves. Not a setting: settings are edited in
 * the settings editor only.
 *
 * @module
 */
import { Choice } from '@/components/Choice';
import { sortCredentials } from '@/credentials/credentialOrder';
import type { CredentialKind } from '@/domain/config/credentials';
import type { Dashboard } from '@/domain/config/dashboard';

import type { Unset } from './dashboardDefault';

const NOUN: Record<CredentialKind, string> = {
  github: 'GitHub token',
  aws: 'AWS key',
};

/** A credential choice, captioned with its kind: the unset option, or one
 * of the dashboard's credentials of that kind, by name. */
export function CredentialSelect({
  dashboard,
  kind,
  value,
  onChange,
  label,
  unset,
}: {
  dashboard: Dashboard;
  kind: CredentialKind;
  value: string | undefined;
  onChange: (id: string | undefined) => void;
  /** The accessible name, e.g. "AWS key for pinned app d1". */
  label: string;
  unset: Unset;
}): React.JSX.Element {
  const credentials = sortCredentials(
    dashboard.credentials.filter((c) => c.kind === kind),
  );
  const plain = credentials.filter((c) => c.id !== unset.id || c.id === value);
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
          { value: '', label: unset.label },
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
