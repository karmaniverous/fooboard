/**
 * First run, step 4 (spec.md §3.9, C-22): the board itself, opened with a
 * note above it whose heading takes focus (§3.10). As the board fills in,
 * the note says how many runs landed in no cell (*Unmapped runs*) and how
 * many rule problems are flagged (*Problems*), naming the board's buttons
 * that list them, the icon-only *Unmapped runs (N)* shown with its icon
 * (spec 0.2.0 §3.A). *Done* closes it.
 *
 * @module
 */
import { Unlink } from 'lucide-react';
import { useId } from 'react';

import { EDIT_DASHBOARD, unmappedLabel } from '@/board/actionLabels';
import { Button } from '@/components/ui/button';
import { useFocusOnMount } from '@/components/useFocusOnMount';

import {
  NO_UNMAPPED_TEXT,
  problemsText,
  STEP_HEADING_CLASS,
  stepOf,
  unmappedText,
} from './words';

/** The unmapped runs: their count, and the button that lists them, named
 * after its icon (decorative; the name says it). */
function Unmapped({ count }: { count: number }): React.ReactNode {
  if (count === 0) return NO_UNMAPPED_TEXT;
  const { before, after } = unmappedText(count);
  return (
    <>
      {before}{' '}
      <Unlink aria-hidden className="inline size-3.5 align-[-0.125em]" />{' '}
      {unmappedLabel(count)} {after}
    </>
  );
}

export function FirstRunNote({
  unmapped,
  problems,
  onDone,
}: {
  /** Runs kept that land in no cell. */
  unmapped: number;
  /** Problems shown (not notes). */
  problems: number;
  onDone: () => void;
}): React.JSX.Element {
  const heading = useFocusOnMount<HTMLHeadingElement>();
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      className="flex max-w-2xl flex-col gap-1 rounded-md border p-3 text-sm"
    >
      <p className="text-muted-foreground">{stepOf(4)}</p>
      <h2
        id={id}
        ref={heading}
        tabIndex={-1}
        className={`text-base ${STEP_HEADING_CLASS}`}
      >
        Your board
      </h2>
      <p>
        Cells fill in as GitHub answers. <Unmapped count={unmapped} />{' '}
        {problemsText(problems)} Change anything with {EDIT_DASHBOARD}.
      </p>
      <Button size="sm" className="self-start" onClick={onDone}>
        Done
      </Button>
    </section>
  );
}
