/**
 * Zod schema for the versioned configuration root (spec.md C-1): everything
 * stored in local storage, several dashboards per browser. The current
 * schema version this codebase understands.
 *
 * @module
 */
import { z } from 'zod';

import { DashboardSchema } from './dashboard';

/** Current config schema version. Bump when the shape changes, and add a
 * migration step in `migrate.ts`. */
export const CURRENT_SCHEMA_VERSION = 6;

/** The versioned configuration root (spec.md C-1). */
export const ConfigRootSchema = z.object({
  schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
  dashboards: z.array(DashboardSchema).default(() => []),
});
export type ConfigRoot = z.infer<typeof ConfigRootSchema>;
