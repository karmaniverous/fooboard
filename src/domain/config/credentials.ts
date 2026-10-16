/**
 * Zod schema for credential references (spec.md C-1a). Each dashboard has
 * its own credentials; this schema stores only the stable id, kind and a
 * display label so other config (e.g. an Amplify source's `credentialId`)
 * can refer to one. The credential's secret material (token or access key)
 * is never part of this schema; it lives in a separate credential store
 * (spec.md step 12, not built here).
 *
 * @module
 */
import { z } from 'zod';

/** Kind of credential a dashboard can hold (spec.md C-5, C-6). */
export const CredentialKindSchema = z.enum(['github', 'aws']);
export type CredentialKind = z.infer<typeof CredentialKindSchema>;

/** A reference to a credential held elsewhere, by stable id. */
export const CredentialRefSchema = z.object({
  id: z.string().min(1),
  kind: CredentialKindSchema,
  label: z.string().min(1),
});
export type CredentialRef = z.infer<typeof CredentialRefSchema>;
