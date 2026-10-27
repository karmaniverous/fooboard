/**
 * First run, step 4 (spec.md §3.9, C-22): the board itself, opened with a
 * note above it whose heading takes focus (§3.10). As the board fills in,
 * the note says how many runs landed in no cell (*Unmapped*) and how many
 * rule problems are flagged (*Problems*), naming the toolbar buttons that
 * list them. *Done* closes it.
 *
 * @module
 */
import { useId } from 'react';

import { Button } from '@/components/ui/button';
import { useFocusOnMount } from '@/components/useFocusOnMount';

import {
  problemsText,
  STEP_HEADING_CLASS,
  stepOf,
  unmappedText,
} from './words';

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
        Cells fill in as GitHub answers. {unmappedText(unmapped)}{' '}
        {problemsText(problems)} Change anything with Edit.
      </p>
      <Button size="sm" className="self-start" onClick={onDone}>
        Done
      </Button>
    </section>
  );
}
