/**
 * Changes to a dashboard's credential list (spec.md C-1a): adding a
 * credential (the first of its kind becomes the default) and removing one
 * (clearing the default and any row or source override that named it, so
 * the dashboard stays valid). Secrets live in the credential store; these
 * functions only touch the configuration. Pure.
 *
 * @module
 */
import type {
  CredentialKind,
  CredentialRef,
} from '@/domain/config/credentials';
import type { Dashboard } from '@/domain/config/dashboard';

/** A new, globally unique credential id (ids key the secret store). */
export const newCredentialId = (): string => crypto.randomUUID();

export function addCredential(
  dashboard: Dashboard,
  ref: CredentialRef,
): Dashboard {
  const defaults = dashboard.defaultCredentials;
  return {
    ...dashboard,
    credentials: [...dashboard.credentials, ref],
    defaultCredentials: defaults[ref.kind]
      ? defaults
      : { ...defaults, [ref.kind]: ref.id },
  };
}

export function setDefaultCredential(
  dashboard: Dashboard,
  kind: CredentialKind,
  id: string,
): Dashboard {
  return {
    ...dashboard,
    defaultCredentials: { ...dashboard.defaultCredentials, [kind]: id },
  };
}

export function removeCredential(dashboard: Dashboard, id: string): Dashboard {
  const keep = (ref: string | undefined) => (ref === id ? undefined : ref);
  const { github, aws } = dashboard.defaultCredentials;
  return {
    ...dashboard,
    credentials: dashboard.credentials.filter((c) => c.id !== id),
    defaultCredentials: { github: keep(github), aws: keep(aws) },
    rows: dashboard.rows.map((row) =>
      row.type === 'github'
        ? { ...row, credentialId: keep(row.credentialId) }
        : {
            ...row,
            githubCredentialId: keep(row.githubCredentialId),
            sources: row.sources.map((s) => ({
              ...s,
              credentialId: keep(s.credentialId),
            })),
          },
    ),
  };
}
