/**
 * A failed action's message (see `useActionError`).
 *
 * @module
 */

export function ActionError({
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
