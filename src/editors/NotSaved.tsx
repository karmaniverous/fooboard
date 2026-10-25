/**
 * *Not saved* (spec.md C-21, §3.11): why the last edit was refused,
 * announced as an alert. Shown by the dashboard editor and the settings
 * popup over `useValidatedChange`'s error.
 *
 * @module
 */
export function NotSaved({
  error,
}: {
  error: string | null;
}): React.JSX.Element | null {
  return error ? (
    <p role="alert" className="text-xs text-status-failure">
      Not saved: {error}
    </p>
  ) : null;
}
