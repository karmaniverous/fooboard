/**
 * The share envelope (spec.md A§3.8 *Share format*, Decisions 39 and 63; a
 * public contract from 0.1.0): one JSON document, the same for a file and
 * a link, holding one or more dashboards exactly as stored and, beside
 * them, their secrets when the user includes them.
 *
 * Reading checks the fixed `format` tag first (so anything else is "not a
 * fooboard share" before a dashboard is parsed), then the envelope's own
 * `formatVersion` and the data model's `schemaVersion`, refusing newer
 * ones; older data models migrate through the chain and are validated by
 * the configuration's own schema. Nothing malformed is defaulted. A
 * refusal of text that is JSON, or isn't, carries its issues, each with
 * its path (spec 0.2.0 §3.J *Field-level errors*), so an assistant that
 * built the share can fix it.
 *
 * @module
 */
import { z } from 'zod';

import { type Dashboard, DashboardSchema } from '@/domain/config/dashboard';
import { migrate } from '@/domain/config/migrate';
import { CURRENT_SCHEMA_VERSION } from '@/domain/config/root';

import {
  issuePath,
  notJsonIssue,
  type ShareIssue,
  shareIssue,
  zodIssues,
} from './issues';
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

/** The fixed tag, checked before anything else. */
const ShareFormatSchema = z.object({ format: z.literal(SHARE_FORMAT) });

/** The envelope as written; `dashboards` are checked after migration. */
const ShareEnvelopeSchema = z.object({
  format: z.literal(SHARE_FORMAT),
  formatVersion: z.int().min(1).max(SHARE_FORMAT_VERSION),
  schemaVersion: z.int().max(CURRENT_SCHEMA_VERSION),
  dashboards: z.array(z.unknown()).min(1),
  credentials: ShareCredentialsSchema,
});

/**
 * A share as an assistant writes it (spec 0.2.0 §3.J, Decision 95): this
 * version's envelope with its dashboards in full and no credentials.
 * `/ai.schema.json` is its JSON Schema (`src/ai/schema.test.ts`).
 */
export const AiShareSchema = z
  .object({
    format: z.literal(SHARE_FORMAT),
    formatVersion: z.literal(SHARE_FORMAT_VERSION),
    schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
    dashboards: z.array(DashboardSchema).min(1),
    credentials: z.null(),
  })
  .meta({
    title: 'fooboard share',
    description:
      'A fooboard share as an AI assistant builds it, with no credentials. Instructions: https://www.fooboard.dev/ai',
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

/** A share refused: why, and what is wrong with it, field by field (none
 * when nothing could be read, e.g. a damaged link). */
export interface ShareRefused {
  ok: false;
  reason: ShareRefusal;
  issues: ShareIssue[];
}

export type ShareRead = { ok: true; share: Share } | ShareRefused;

/** A refusal for `reason`, with `issues`. */
export const refused = (
  reason: ShareRefusal,
  issues: ShareIssue[] = [],
): ShareRefused => ({ ok: false, reason, issues });

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

/** An issue for each version field above what this app reads. */
function newerIssues(raw: Record<string, unknown>): ShareIssue[] {
  const known = {
    formatVersion: SHARE_FORMAT_VERSION,
    schemaVersion: CURRENT_SCHEMA_VERSION,
  };
  return Object.entries(known).flatMap(([field, max]) => {
    const v = raw[field];
    return Number.isInteger(v) && Number(v) > max
      ? [
          shareIssue(
            [field],
            `newer than this fooboard reads (at most ${String(max)})`,
          ),
        ]
      : [];
  });
}

/** Where each id first appears, and an issue for each later repeat. */
function repeats(
  places: readonly { id: string; path: PropertyKey[] }[],
): ShareIssue[] {
  const first = new Map<string, PropertyKey[]>();
  return places.flatMap(({ id, path }) => {
    const seen = first.get(id);
    if (seen) return [shareIssue(path, `repeats ${issuePath(seen)}`)];
    first.set(id, path);
    return [];
  });
}

/** Ids repeated across the share's dashboards, or their credentials
 * (either would make two dashboards, or two secrets, one), each naming
 * both places: `dashboards[2].id: repeats dashboards[0].id`. */
export function repeatedIds(dashboards: readonly Dashboard[]): ShareIssue[] {
  return [
    ...repeats(
      dashboards.map((d, i) => ({ id: d.id, path: ['dashboards', i, 'id'] })),
    ),
    ...repeats(
      dashboards.flatMap((d, i) =>
        d.credentials.map((c, ci) => ({
          id: c.id,
          path: ['dashboards', i, 'credentials', ci, 'id'],
        })),
      ),
    ),
  ];
}

const credentialsIn = (c: ShareCredentials): ShareCredentialsIn => {
  if (c === null) return { kind: 'none' };
  return c.encrypted
    ? { kind: 'encrypted', block: c }
    : { kind: 'plain', secrets: c.secrets };
};

/** The dashboards migrated to this data model, or the issues that stop
 * them: the configuration schema's, at their paths (which start at
 * `dashboards`), or a step's refusal, about the share as a whole. */
function migrated(
  schemaVersion: number,
  dashboards: unknown[],
): { ok: true; dashboards: Dashboard[] } | { ok: false; issues: ShareIssue[] } {
  try {
    return {
      ok: true,
      dashboards: migrate({ schemaVersion, dashboards }).dashboards,
    };
  } catch (err) {
    return {
      ok: false,
      issues:
        err instanceof z.ZodError
          ? zodIssues(err)
          : [shareIssue([], err instanceof Error ? err.message : String(err))],
    };
  }
}

/** Read a share from its JSON text. */
export function readShare(text: string): ShareRead {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (err) {
    return refused('damaged', [notJsonIssue(err)]);
  }
  const format = ShareFormatSchema.safeParse(raw);
  if (!format.success) return refused('notShare', zodIssues(format.error));
  const newer = newerIssues(z.record(z.string(), z.unknown()).parse(raw));
  if (newer.length > 0) return refused('newer', newer);
  const envelope = ShareEnvelopeSchema.safeParse(raw);
  if (!envelope.success) return refused('damaged', zodIssues(envelope.error));
  const read = migrated(envelope.data.schemaVersion, envelope.data.dashboards);
  if (!read.ok) return refused('damaged', read.issues);
  const repeated = repeatedIds(read.dashboards);
  if (repeated.length > 0) return refused('damaged', repeated);
  return {
    ok: true,
    share: {
      dashboards: read.dashboards,
      credentials: credentialsIn(envelope.data.credentials),
    },
  };
}
