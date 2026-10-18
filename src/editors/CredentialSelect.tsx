/**
 * A credential choice for a row, an Amplify source or a row group
 * (spec.md C-1a): inherit, or pick one of the dashboard's credentials.
 *
 * @module
 */
import { NativeSelect } from '@/components/NativeSelect';
import type { CredentialKind } from '@/domain/config/credentials';
import type { Dashboard } from '@/domain/config/dashboard';

/** A credential choice: inherit (the label says from where), or one of the
 * dashboard's credentials of that kind. */
export function CredentialSelect({
  dashboard,
  kind,
  value,
  onChange,
  label,
  inheritFrom = 'dashboard',
}: {
  dashboard: Dashboard;
  kind: CredentialKind;
  value: string | undefined;
  onChange: (id: string | undefined) => void;
  label: string;
  /** Where the empty choice inherits from (C-1a). */
  inheritFrom?: 'group' | 'dashboard';
}): React.JSX.Element {
  return (
    <NativeSelect
      aria-label={label}
      className="h-8 px-1 text-xs"
      value={value ?? ''}
      onChange={(e) => {
        onChange(e.target.value || undefined);
      }}
    >
      <option value="">
        {inheritFrom === 'group' ? 'Group default' : 'Dashboard default'}
      </option>
      {dashboard.credentials
        .filter((c) => c.kind === kind)
        .map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
    </NativeSelect>
  );
}
