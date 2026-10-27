/**
 * A first-run step's frame (spec.md §3.9, C-22): *Step N of 4* above the
 * step's heading, which takes focus as the step opens (§3.10), and the
 * step's content.
 *
 * @module
 */
import { useId } from 'react';

import { useFocusOnMount } from '@/components/useFocusOnMount';

import { STEP_HEADING_CLASS, stepOf } from './words';

export function StepFrame({
  step,
  title,
  children,
}: {
  step: number;
  title: string;
  children: React.ReactNode;
}): React.JSX.Element {
  const heading = useFocusOnMount<HTMLHeadingElement>();
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      className="mx-auto flex w-full min-w-0 max-w-xl flex-col gap-4 px-6 py-12"
    >
      <p className="text-sm text-muted-foreground">{stepOf(step)}</p>
      <h1
        id={id}
        ref={heading}
        tabIndex={-1}
        className={`text-xl ${STEP_HEADING_CLASS}`}
      >
        {title}
      </h1>
      {children}
    </section>
  );
}
