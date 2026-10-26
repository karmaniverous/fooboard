/**
 * Progress and failure for an on-demand load (repos, apps, branches),
 * with *Try again* on failure where the load has no button of its own
 * (the first run's steps load as they open).
 *
 * @module
 */
import { Button } from '@/components/ui/button';

import type { LoadState } from './useLoad';

export function LoadStatus({
  state,
  loading,
  onRetry,
}: {
  state: LoadState<unknown>;
  /** Offered as *Try again* after a failure. */
  onRetry?: () => void;
  /** e.g. "Loading repos…" */
  loading: string;
}): React.JSX.Element | null {
  if (state.kind === 'loading') {
    return loading ? <p className="text-xs">{loading}</p> : null;
  }
  if (state.kind === 'error') {
    return (
      <>
        <p role="alert" className="text-xs text-status-failure">
          {state.message}
        </p>
        {onRetry && (
          <Button variant="outline" className="self-start" onClick={onRetry}>
            Try again
          </Button>
        )}
      </>
    );
  }
  return null;
}
