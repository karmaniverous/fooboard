/**
 * First run, step 4 (spec.md §3.9, C-22): the board itself, opened with a
 * note above it whose heading takes focus (§3.10). As the board fills in,
 * the note says how many runs landed in no cell (*Unmapped runs*) and how
 * many rule problems are flagged (*Problems*), naming the board's buttons
 * that list them, and *Edit dashboard* for changes. Each button it names
 * is shown with its icon inline before its name, as on the board (spec
 * 0.2.0 §3.A, *First-run note icons*). *Done* closes it.
 *
 * @module
 */
import type { LucideIcon } from 'lucide-react';
import { useId } from 'react';

import {
  EDIT_DASHBOARD_ICON,
  PROBLEMS_ICON,
  UNMAPPED_RUNS_ICON,
} from '@/board/actionIcons';
import {
  EDIT_DASHBOARD,
  problemsLabel,
  unmappedLabel,
} from '@/board/actionLabels';
import { Button } from '@/components/ui/button';
import { useFocusOnMount } from '@/components/useFocusOnMount';

import {
  NO_PROBLEMS_TEXT,
  NO_UNMAPPED_TEXT,
  problemsText,
  STEP_HEADING_CLASS,
  stepOf,
  unmappedText,
} from './words';

/** A board button's name, after its icon (decorative; the name says it). */
function Named({
  Icon,
  name,
}: {
  Icon: LucideIcon;
  name: string;
}): React.ReactNode {
  return (
    <>
      <Icon aria-hidden className="inline size-3.5 align-[-0.125em]" /> {name}
    </>
  );
}

/** A counted button the note names: the words around it while it has
 * entries, else what the note says while there's no button yet. */
function Counted({
  count,
  Icon,
  label,
  text,
  none,
}: {
  count: number;
  Icon: LucideIcon;
  label: (count: number) => string;
  text: (count: number) => { before: string; after: string };
  none: string;
}): React.ReactNode {
  if (count === 0) return none;
  const { before, after } = text(count);
  return (
    <>
      {before} <Named Icon={Icon} name={label(count)} />
      {after}
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
        Cells fill in as GitHub answers.{' '}
        <Counted
          count={unmapped}
          Icon={UNMAPPED_RUNS_ICON}
          label={unmappedLabel}
          text={unmappedText}
          none={NO_UNMAPPED_TEXT}
        />{' '}
        <Counted
          count={problems}
          Icon={PROBLEMS_ICON}
          label={problemsLabel}
          text={problemsText}
          none={NO_PROBLEMS_TEXT}
        />{' '}
        Change anything with{' '}
        <Named Icon={EDIT_DASHBOARD_ICON} name={EDIT_DASHBOARD} />.
      </p>
      <Button size="sm" className="self-start" onClick={onDone}>
        Done
      </Button>
    </section>
  );
}
