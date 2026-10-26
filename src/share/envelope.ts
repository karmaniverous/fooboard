/**
 * The share envelope (spec.md §3.8 *Share format*, Decisions 39 and 63; a
 * public contract from 0.1.0): one JSON document, the same for a file and
 * a link, holding one or more dashboards exactly as stored and, beside
 * them, their secrets when the user includes them.
 *
 * Reading checks the fixed `format` tag first (so anything else is "not a
 * fooboard share" before a dashboard is parsed), then the envelope's own
 * `formatVersion` and the data model's `schemaVersion`, refusing newer
 * ones; older data models migrate through the chain and are validated by
 * the configuration's own schema. Nothing malformed is defaulted.
 *
 * @module
 */
import { z } from 'zod';

import type { Dashboard } from '@/domain/config/dashboard';
import { migrate } from '@/domain/config/migrate';
import { CURRENT_SCHEMA_VERSION } from '@/domain/config/root';

import {
  type EncryptedCredentials,
  EncryptedCredentialsSchema,
  PlainCredentialsSchema,
  type ShareSecrets,
} from './secrets';

/** The fixed tag every share carries. */
export const SHARE_FORMAT = 'fooboard-share';
/** The envelope's own version: changes only when the envelope does. */
export const SHARE_FORMAT_VERSION = 1;

const ShareCredentialsSchema = z
  .discriminatedUnion('encrypted', [
    PlainCredentialsSchema,
    EncryptedCredentialsSchema,
  ])
  .nullable();
export type ShareCredentials = z.infer<typeof ShareCredentialsSchema>;

/** The envelope as written; `dashboards` are checked after migration. */
const ShareEnvelopeSchema = z.object({
  format: z.literal(SHARE_FORMAT),
  formatVersion: z.int().min(1).max(SHARE_FORMAT_VERSION),
  schemaVersion: z.int().max(CURRENT_SCHEMA_VERSION),
  dashboards: z.array(z.unknown()).min(1),
  credentials: ShareCredentialsSchema,
});

/** A share as written by this version. */
export interface ShareEnvelope {
  format: typeof SHARE_FORMAT;
  formatVersion: typeof SHARE_FORMAT_VERSION;
  schemaVersion: typeof CURRENT_SCHEMA_VERSION;
  dashboards: Dashboard[];
  credentials: ShareCredentials;
}

/** What credentials a share carries. */
export type ShareCredentialsIn =
  | { kind: 'none' }
  | { kind: 'plain'; secrets: ShareSecrets }
  | { kind: 'encrypted'; block: EncryptedCredentials };

/** A share, read and migrated to the current data model. */
export interface Share {
  dashboards: Dashboard[];
  credentials: ShareCredentialsIn;
}

/** Why a share was refused. */
export type ShareRefusal = 'notShare' | 'newer' | 'damaged';

export type ShareRead =
  { ok: true; share: Share } | { ok: false; reason: ShareRefusal };

/** The envelope for `dashboards` and their `credentials` (`null`: none). */
export const buildEnvelope = (
  dashboards: Dashboard[],
  credentials: ShareCredentials,
): ShareEnvelope => ({
  format: SHARE_FORMAT,
  formatVersion: SHARE_FORMAT_VERSION,
  schemaVersion: CURRENT_SCHEMA_VERSION,
  dashboards,
  credentials,
});

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Is a version a whole number above what this app knows? */
const above = (v: unknown, known: number): boolean =>
  Number.isInteger(v) && Number(v) > known;

/** Ids repeated across the share's dashboards, or their credentials:
 * either would make two dashboards (or two secrets) one. */
function repeatsIds(dashboards: readonly Dashboard[]): boolean {
  const ids = dashboards.map((d) => d.id);
  const credentialIds = dashboards.flatMap((d) =>
    d.credentials.map((c) => c.id),
  );
  return (
    new Set(ids).size !== ids.length ||
    new Set(credentialIds).size !== credentialIds.length
  );
}

const credentialsIn = (c: ShareCredentials): ShareCredentialsIn => {
  if (c === null) return { kind: 'none' };
  return c.encrypted
    ? { kind: 'encrypted', block: c }
    : { kind: 'plain', secrets: c.secrets };
};

/** Read a share from its JSON text. */
export function readShare(text: string): ShareRead {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'damaged' };
  }
  if (!isRecord(raw) || raw.format !== SHARE_FORMAT) {
    return { ok: false, reason: 'notShare' };
  }
  if (
    above(raw.formatVersion, SHARE_FORMAT_VERSION) ||
    above(raw.schemaVersion, CURRENT_SCHEMA_VERSION)
  ) {
    return { ok: false, reason: 'newer' };
  }
  const envelope = ShareEnvelopeSchema.safeParse(raw);
  if (!envelope.success) return { ok: false, reason: 'damaged' };
  let dashboards: Dashboard[];
  try {
    ({ dashboards } = migrate({
      schemaVersion: envelope.data.schemaVersion,
      dashboards: envelope.data.dashboards,
    }));
  } catch {
    return { ok: false, reason: 'damaged' };
  }
  if (repeatsIds(dashboards)) return { ok: false, reason: 'damaged' };
  return {
    ok: true,
    share: {
      dashboards,
      credentials: credentialsIn(envelope.data.credentials),
    },
  };
}
