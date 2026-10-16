/**
 * Zod schema for row and column dividers (spec.md C-14b). A divider is
 * attached to the row or column after it (`beforeId`), so it moves with
 * that header when dragged; it may carry a label shown as a group heading
 * over the rows or columns up to the next divider.
 *
 * @module
 */
import { z } from 'zod';

/** Divider line style (spec.md C-14b). */
export const DividerStyleSchema = z.enum([
  'thin',
  'thick',
  'double',
  'dashed',
  'blank',
]);
export type DividerStyle = z.infer<typeof DividerStyleSchema>;

/**
 * A divider placed immediately before the row or stage identified by
 * `beforeId`, with an optional group-heading label.
 */
export const DividerSchema = z.object({
  beforeId: z.string().min(1),
  style: DividerStyleSchema,
  label: z.string().min(1).optional(),
});
export type Divider = z.infer<typeof DividerSchema>;
