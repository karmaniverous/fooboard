/**
 * The one validated save path for dashboard edits (spec.md C-21, §3.11
 * *Saving*): a change is parsed against the dashboard schema before it is
 * handed on, so an edit can never leave a dashboard that won't load. A
 * change the schema refuses, or a save that throws, is reported as the
 * error *Not saved* shows, and the stored dashboard is left unchanged.
 * Used by the dashboard editor and the board's settings popup alike.
 *
 * @module
 */
import { useState } from 'react';

import { type Dashboard, DashboardSchema } from '@/domain/config/dashboard';
import { describeError } from '@/lib/errors';

export function useValidatedChange(onChange: (dashboard: Dashboard) => void): {
  /** Validate `next` and save it, or record why not; says whether it
   * was saved. */
  update: (next: Dashboard) => boolean;
  /** Why the last change wasn't saved, if it wasn't. */
  error: string | null;
} {
  const [error, setError] = useState<string | null>(null);
  const update = (next: Dashboard) => {
    const parsed = DashboardSchema.safeParse(next);
    if (!parsed.success) {
      setError(parsed.error.issues.map((i) => i.message).join('; '));
      return false;
    }
    try {
      onChange(parsed.data);
      setError(null);
      return true;
    } catch (err) {
      setError(describeError(err));
      return false;
    }
  };
  return { update, error };
}
