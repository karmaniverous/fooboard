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

/** Rewrite every credential reference (defaults, row and source
 * overrides) through `map`; `undefined` clears a reference. */
export function mapCredentialRefs(
  dashboard: Dashboard,
  map: (ref: string) => string | undefined,
): Dashboard {
  const re = (ref: string | undefined) => (ref ? map(ref) : undefined);
  const { github, aws } = dashboard.defaultCredentials;
  return {
    ...dashboard,
    defaultCredentials: { github: re(github), aws: re(aws) },
    rows: dashboard.rows.map((row) =>
      row.type === 'github'
        ? { ...row, credentialId: re(row.credentialId) }
        : {
            ...row,
            githubCredentialId: re(row.githubCredentialId),
            sources: row.sources.map((s) => ({
              ...s,
              credentialId: re(s.credentialId),
            })),
          },
    ),
  };
}

export function removeCredential(dashboard: Dashboard, id: string): Dashboard {
  const cleared = mapCredentialRefs(dashboard, (ref) =>
    ref === id ? undefined : ref,
  );
  return {
    ...cleared,
    credentials: dashboard.credentials.filter((c) => c.id !== id),
  };
}
