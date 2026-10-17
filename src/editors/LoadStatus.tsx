/**
 * Progress and failure for an on-demand load (repos, apps, branches).
 *
 * @module
 */
import type { LoadState } from './useLoad';

export function LoadStatus({
  state,
  loading,
}: {
  state: LoadState<unknown>;
  /** e.g. "Loading repos…" */
  loading: string;
}): React.JSX.Element | null {
  if (state.kind === 'loading') {
    return loading ? <p className="text-xs">{loading}</p> : null;
  }
  if (state.kind === 'error') {
    return (
      <p role="alert" className="text-xs text-status-failure">
        {state.message}
      </p>
    );
  }
  return null;
}
