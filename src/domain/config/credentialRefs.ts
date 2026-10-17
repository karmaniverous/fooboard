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

/** The credential id to use: the override if set, else the row group's
 * default (spec.md C-1a), else the dashboard default for that kind, else
 * `undefined` (the cell shows *needs credential*). */
export function resolveCredentialId(
  defaults: DefaultCredentials,
  kind: CredentialKind,
  override?: string,
  rowGroupDefaults?: DefaultCredentials,
): string | undefined {
  return override ?? rowGroupDefaults?.[kind] ?? defaults[kind];
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

function rowGroupUses(group: RowGroup, index: number): CredentialUse[] {
  const at = (kind: string) => ['rowGroups', index, 'defaultCredentials', kind];
  return (['github', 'aws'] as const).flatMap((kind) => {
    const id = group.defaultCredentials[kind];
    return id ? [{ id, kind, path: at(kind) }] : [];
  });
}

/** Every reference that names no credential, or one of the wrong kind. */
export function credentialReferenceIssues(dashboard: {
  credentials: readonly CredentialRef[];
  defaultCredentials: DefaultCredentials;
  rows: readonly Row[];
  rowGroups?: readonly RowGroup[];
}): { message: string; path: (string | number)[] }[] {
  const kindOf = new Map(dashboard.credentials.map((c) => [c.id, c.kind]));
  const defaults = (['github', 'aws'] as const).flatMap((kind) => {
    const id = dashboard.defaultCredentials[kind];
    return id ? [{ id, kind, path: ['defaultCredentials', kind] }] : [];
  });
  const uses: CredentialUse[] = [
    ...defaults,
    ...dashboard.rows.flatMap(rowUses),
    ...(dashboard.rowGroups ?? []).flatMap(rowGroupUses),
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
