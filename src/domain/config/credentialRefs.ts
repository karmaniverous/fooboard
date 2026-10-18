/**
 * Which credential reads what (spec.md C-1a): a dashboard names a default
 * GitHub token and a default AWS key, and a row (or an Amplify source) may
 * override either. This module resolves the effective credential and finds
 * references that point at a missing credential or one of the wrong kind.
 * Pure.
 *
 * @module
 */
import { z } from 'zod';

import type { CredentialKind, CredentialRef } from './credentials';
import type { RowGroup } from './groups';
import type { Row } from './row';

/** The dashboard's default credential per kind; either may be unset. */
export const DefaultCredentialsSchema = z.object({
  github: z.string().min(1).optional(),
  aws: z.string().min(1).optional(),
});
export type DefaultCredentials = z.infer<typeof DefaultCredentialsSchema>;

/** The credential id to use: the override if set, else the inherited
 * default for that kind (see `inheritedCredentials`, spec.md C-1a), else
 * `undefined` (the cell shows *needs credential*). */
export function resolveCredentialId(
  defaults: DefaultCredentials,
  kind: CredentialKind,
  override?: string,
): string | undefined {
  return override ?? defaults[kind];
}

/** One credential reference somewhere in a dashboard. */
interface CredentialUse {
  id: string;
  kind: CredentialKind;
  path: (string | number)[];
}

function rowUses(row: Row, index: number): CredentialUse[] {
  const at = (...rest: (string | number)[]) => ['rows', index, ...rest];
  if (row.type === 'github') {
    return row.credentialId
      ? [{ id: row.credentialId, kind: 'github', path: at('credentialId') }]
      : [];
  }
  const sources = row.sources.flatMap((s, i) =>
    s.credentialId
      ? [
          {
            id: s.credentialId,
            kind: 'aws' as const,
            path: at('sources', i, 'credentialId'),
          },
        ]
      : [],
  );
  return row.githubCredentialId
    ? [
        ...sources,
        {
          id: row.githubCredentialId,
          kind: 'github',
          path: at('githubCredentialId'),
        },
      ]
    : sources;
}

/** The references in a set of default credentials found at `path`. */
function defaultUses(
  defaults: DefaultCredentials,
  ...path: (string | number)[]
): CredentialUse[] {
  return (['github', 'aws'] as const).flatMap((kind) => {
    const id = defaults[kind];
    return id ? [{ id, kind, path: [...path, kind] }] : [];
  });
}

/** Every reference that names no credential, or one of the wrong kind. */
export function credentialReferenceIssues(dashboard: {
  credentials: readonly CredentialRef[];
  defaultCredentials: DefaultCredentials;
  rows: readonly Row[];
  rowGroups: readonly RowGroup[];
}): { message: string; path: (string | number)[] }[] {
  const kindOf = new Map(dashboard.credentials.map((c) => [c.id, c.kind]));
  const uses: CredentialUse[] = [
    ...defaultUses(dashboard.defaultCredentials, 'defaultCredentials'),
    ...dashboard.rows.flatMap(rowUses),
    ...dashboard.rowGroups.flatMap((g, i) =>
      defaultUses(g.defaultCredentials, 'rowGroups', i, 'defaultCredentials'),
    ),
  ];

  return uses.flatMap(({ id, kind, path }) => {
    const actual = kindOf.get(id);
    if (actual === undefined) {
      return [{ message: `unknown credential: ${id}`, path }];
    }
    return actual === kind
      ? []
      : [{ message: `credential ${id} is ${actual}, expected ${kind}`, path }];
  });
}
