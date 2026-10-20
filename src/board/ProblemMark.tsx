/**
 * A problem marker (spec.md A§4.3.7): a small warning sign whose label
 * lists the problems there. Clicking it opens the editor at the (first)
 * problem, where the board has an editor.
 *
 * @module
 */
import type { Problem } from '@/domain/problems/problem';

import { useProblemMarks } from './problemMarksContext';

export function ProblemMark({
  problems,
}: {
  problems: readonly Problem[] | undefined;
}): React.JSX.Element | null {
  const { onOpen } = useProblemMarks();
  const first = problems?.at(0);
  if (!problems || !first) return null;
  const n = problems.length;
  const label = `${String(n)} problem${n === 1 ? '' : 's'}: ${problems.map((p) => p.message).join('; ')}`;
  const className =
    'ml-1 shrink-0 font-bold text-amber-600 dark:text-amber-400';
  return onOpen ? (
    <button
      type="button"
      aria-label={`${label}. Open the editor at it`}
      title={label}
      className={`${className} rounded-sm px-0.5 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
      onClick={(e) => {
        e.stopPropagation();
        onOpen(first);
      }}
    >
      !
    </button>
  ) : (
    <span role="img" aria-label={label} title={label} className={className}>
      !
    </span>
  );
}
