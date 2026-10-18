/**
 * Display names of the credential kinds.
 *
 * @module
 */
import type { CredentialKind } from '@/domain/config/credentials';

export const KIND_LABEL: Record<CredentialKind, string> = {
  github: 'GitHub token',
  aws: 'AWS key',
};
