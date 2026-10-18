/**
 * Status sets (spec.md A§4.3.6): for one provider, the summary statuses
 * (the board's chips) and the ordered cell statuses, each with a JSON
 * Schema test over the cell's normalised document; the first match wins.
 * `unknown` is reserved for the built-in status a run matching none takes.
 *
 * @module
 */
import { z } from 'zod';

import { HexColorSchema } from './colors';

const StatusProviderSchema = z.enum(['github', 'amplify']);

/** The glyphs a status can show (the board's status icons). */
const StatusIconSchema = z.enum([
  'success',
  'failure',
  'running',
  'queued',
  'partial',
  'cancelled',
  'unknown',
]);

/** The id of the built-in Unknown status and summary status. */
const UNKNOWN_STATUS_ID = 'unknown';

const StatusIdSchema = z
  .string()
  .min(1)
  .refine((id) => id !== UNKNOWN_STATUS_ID, {
    message: `"${UNKNOWN_STATUS_ID}" is reserved for the built-in status`,
  });

/** A summary status: a board chip and filter. A cell counting toward one
 * marked `inProgress` is polled at the active interval (C-16). */
const SummaryStatusSchema = z.object({
  id: StatusIdSchema,
  name: z.string().min(1),
  color: HexColorSchema,
  icon: StatusIconSchema,
  inProgress: z.boolean().default(false),
});
export type SummaryStatus = z.infer<typeof SummaryStatusSchema>;

/** A JSON Schema object (validated as JSON Schema when it is used). */
const JsonSchemaObjectSchema = z.record(z.string(), z.unknown());

/** A cell status: shown when its `test` is the first in the set to match. */
const CellStatusSchema = z.object({
  id: StatusIdSchema,
  name: z.string().min(1),
  color: HexColorSchema,
  /** The summary status it counts toward. */
  summary: z.string().min(1),
  /** Defaults to its summary status's icon. */
  icon: StatusIconSchema.optional(),
  /** Drawn with a dashed outline (today's Queued look). */
  outlined: z.boolean().default(false),
  test: JsonSchemaObjectSchema,
});
export type CellStatus = z.infer<typeof CellStatusSchema>;

const duplicates = (ids: readonly string[]): string[] =>
  ids.filter((id, i) => ids.indexOf(id) !== i);

export const StatusSetSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    provider: StatusProviderSchema,
    summary: z.array(SummaryStatusSchema).min(1),
    cell: z.array(CellStatusSchema).min(1),
  })
  .superRefine((set, ctx) => {
    const summaryIds = set.summary.map((s) => s.id);
    for (const id of duplicates(summaryIds))
      ctx.addIssue({
        code: 'custom',
        message: `duplicate summary status id: ${id}`,
        path: ['summary'],
      });
    for (const id of duplicates(set.cell.map((c) => c.id)))
      ctx.addIssue({
        code: 'custom',
        message: `duplicate cell status id: ${id}`,
        path: ['cell'],
      });
    set.cell.forEach((c, i) => {
      if (!summaryIds.includes(c.summary))
        ctx.addIssue({
          code: 'custom',
          message: `cell status ${c.id} counts toward unknown summary status ${c.summary}`,
          path: ['cell', i, 'summary'],
        });
    });
  });
export type StatusSet = z.infer<typeof StatusSetSchema>;
