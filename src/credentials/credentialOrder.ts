/**
 * The display order of credentials (spec.md C-1a): by name, ignoring case
 * and accents, then by id so equal names keep a stable order. For display
 * only: a dashboard stores its credentials in the order they were added.
 *
 * @module
 */
import type { CredentialRef } from '@/domain/config/credentials';

type Named = Pick<CredentialRef, 'id' | 'label'>;

const byId = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Compares two credentials for display. */
const compareCredentials = (a: Named, b: Named): number =>
  a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }) ||
  byId(a.id, b.id);

/** `list` sorted for display by each item's credential (`of`); a copy, so
 * the stored order is left alone. */
export const sortByCredential = <T>(
  list: readonly T[],
  of: (item: T) => Named,
): T[] => [...list].sort((a, b) => compareCredentials(of(a), of(b)));

/** `credentials` sorted for display; a copy. */
export const sortCredentials = <T extends Named>(
  credentials: readonly T[],
): T[] => sortByCredential(credentials, (c) => c);
