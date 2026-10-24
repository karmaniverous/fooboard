/**
 * Credential references (spec.md C-1a, §3.11): a GitHub token or an AWS
 * key named in a settings object at any of the six levels, or the key a
 * pinned app serves. This module finds references that point at a
 * missing credential or one of the wrong kind; which credential a cell
 * reads is the settings resolver's (`resolveSetting`). Pure.
 *
 * @module
 */
import { heldSettings } from '@/domain/settings/places';

import type { CredentialKind, CredentialRef } from './credentials';
import type { Dashboard } from './dashboard';

/** One credential reference somewhere in a dashboard. */
interface CredentialUse {
  id: string;
  kind: CredentialKind;
  path: (string | number)[];
}

type Scope = Pick<
  Dashboard,
  'credentials' | 'settings' | 'rowGroups' | 'columnGroups' | 'rows' | 'stages'
>;

/** Every credential a dashboard names, with its path. */
function uses(dashboard: Scope): CredentialUse[] {
  const fromSettings = heldSettings(dashboard).flatMap(
    ({ settings, path }): CredentialUse[] => [
      ...(settings.githubToken
        ? [
            {
              id: settings.githubToken,
              kind: 'github' as const,
              path: [...path, 'githubToken'],
            },
          ]
        : []),
      ...(settings.awsKey
        ? [
            {
              id: settings.awsKey,
              kind: 'aws' as const,
              path: [...path, 'awsKey'],
            },
          ]
        : []),
    ],
  );
  const fromPins = dashboard.rows.flatMap((row, r): CredentialUse[] =>
    row.type === 'amplify'
      ? row.pinnedApps.flatMap((pin, p) =>
          pin.credentialId
            ? [
                {
                  id: pin.credentialId,
                  kind: 'aws' as const,
                  path: ['rows', r, 'pinnedApps', p, 'credentialId'],
                },
              ]
            : [],
        )
      : [],
  );
  return [...fromSettings, ...fromPins];
}

/** Every reference that names no credential, or one of the wrong kind. */
export function credentialReferenceIssues(
  dashboard: Scope,
): { message: string; path: (string | number)[] }[] {
  const kindOf = new Map(
    dashboard.credentials.map((c: CredentialRef) => [c.id, c.kind]),
  );
  return uses(dashboard).flatMap(({ id, kind, path }) => {
    const actual = kindOf.get(id);
    if (actual === undefined) {
      return [{ message: `unknown credential: ${id}`, path }];
    }
    return actual === kind
      ? []
      : [{ message: `credential ${id} is ${actual}, expected ${kind}`, path }];
  });
}
