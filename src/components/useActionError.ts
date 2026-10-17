/**
 * Report failed user actions (spec.md C-4: storage can refuse a write).
 * `run` performs an action and returns whether it succeeded; on failure
 * the inputs stay as they were, so the user can retry, and the error is
 * shown. Storage and network errors carry no credential values, so their
 * messages are safe to show.
 *
 * @module
 */
import { useState } from 'react';

import { describeError } from '@/lib/errors';

export function useActionError(): [
  string | null,
  (action: () => void) => boolean,
] {
  const [error, setError] = useState<string | null>(null);
  const run = (action: () => void) => {
    try {
      action();
      setError(null);
      return true;
    } catch (err) {
      setError(describeError(err));
      return false;
    }
  };
  return [error, run];
}
