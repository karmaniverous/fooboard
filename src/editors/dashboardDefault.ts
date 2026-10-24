/**
 * The unset option of a credential choice (spec.md §3.11 *Origins*): what
 * leaving it unset means. A picker lists with the dashboard's own
 * setting, *Dashboard default (<name>)*, or *None (no default is set)*.
 * Pure.
 *
 * @module
 */
import type { CredentialKind } from '@/domain/config/credentials';
import type { Dashboard } from '@/domain/config/dashboard';

/** What leaving the choice unset means, and the credential it stands for
 * (listed only as the unset option, unless it is also the value). */
export interface Unset {
  label: string;
  id?: string;
}

/** The unset option of a picker's choice: the dashboard's own setting
 * (*Dashboard default (<name>)*), or *None (no default is set)*. */
export function dashboardDefault(
  dashboard: Dashboard,
  kind: CredentialKind,
): Unset {
  const id =
    kind === 'github'
      ? dashboard.settings.githubToken
      : dashboard.settings.awsKey;
  const name = dashboard.credentials.find((c) => c.id === id)?.label;
  return name
    ? { label: `Dashboard default (${name})`, id }
    : { label: 'None (no default is set)' };
}
