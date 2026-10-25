/**
 * The board's header row (spec.md C-13, C-14b): the pinned corner, then
 * one header per stage, its name cut to the column and in full in its
 * tooltip, its problem marker and its settings gear (spec.md §3.11).
 * Clicking a header opens nothing; its gear opens the stage's settings.
 *
 * @module
 */
import { WithTooltip } from '@/components/ui/tooltip';
import type { Stage } from '@/domain/config/stage';
import { cn } from '@/lib/utils';

import type { ColumnLines } from './columnFrame';
import { BOUNDARY } from './gridStyles';
import { capText } from './layout';
import { ProblemMark } from './ProblemMark';
import { useProblemMarks } from './problemMarksContext';
import { SettingsGear } from './SettingsGear';
import { stageLabel } from './stageLabel';

export function StageHeaders({
  stages,
  lines,
  frameTop,
  pinTop,
  pinLeft,
  style,
}: {
  stages: readonly Stage[];
  /** Where the group boundaries run (C-14b). */
  lines: ColumnLines;
  /** Stages whose header carries the top of their group's frame. */
  frameTop: ReadonlySet<string>;
  /** The pinned classes, top and left. */
  pinTop: string;
  pinLeft: string;
  /** The header row's height. */
  style: React.CSSProperties;
}): React.JSX.Element {
  const marks = useProblemMarks();
  return (
    <div role="row" className="contents">
      <div
        role="columnheader"
        className={cn(pinTop, pinLeft, 'z-30')}
        style={style}
      />
      {stages.map((stage) => (
        <WithTooltip key={stage.id} label={stageLabel(stage)}>
          <div
            role="columnheader"
            // Focusable, so the keyboard can show its tooltip.
            tabIndex={0}
            className={cn(
              'flex items-center justify-center truncate px-[var(--cell-pad-x)] text-center font-semibold',
              pinTop,
              lines.headerLeft.has(stage.id) && BOUNDARY.left,
              lines.headerRight.has(stage.id) && BOUNDARY.right,
              frameTop.has(stage.id) && BOUNDARY.top,
            )}
            style={style}
          >
            <span className="truncate">{capText(stage.name)}</span>
            <ProblemMark problems={marks.stages.get(stage.id)} />
            <SettingsGear
              place={{ level: 'column', stageId: stage.id }}
              spot="header"
            />
          </div>
        </WithTooltip>
      ))}
    </div>
  );
}
