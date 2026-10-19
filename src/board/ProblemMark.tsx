/**
 * A problem marker on a header (spec.md A§4.3.7): a small warning sign
 * whose label lists the problems there.
 *
 * @module
 */
export function ProblemMark({
  messages,
}: {
  messages: readonly string[] | undefined;
}): React.JSX.Element | null {
  if (!messages?.length) return null;
  const label = `${String(messages.length)} problem${messages.length === 1 ? '' : 's'}: ${messages.join('; ')}`;
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className="ml-1 shrink-0 font-bold text-amber-600 dark:text-amber-400"
    >
      !
    </span>
  );
}
