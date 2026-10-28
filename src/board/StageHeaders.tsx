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

import { PIN_LEFT, PIN_TOP } from './gridStyles';
import { capText } from './layout';
import { ProblemMark } from './ProblemMark';
import { useProblemMarks } from './problemMarksContext';
import { SettingsGear } from './SettingsGear';
import { stageLabel } from './stageLabel';

export function StageHeaders({
  stages,
  columns,
  style,
}: {
  stages: readonly Stage[];
  /** Each stage's grid column, by stage index: gutters sit between
   * groups (spec.md §3.7). */
  columns: readonly number[];
  /** The header row's height. */
  style: React.CSSProperties;
}): React.JSX.Element {
  const marks = useProblemMarks();
  return (
    <div role="row" className="contents">
      <div
        role="columnheader"
        className={cn(PIN_TOP, PIN_LEFT, 'z-30')}
        style={{ ...style, gridColumn: '1' }}
      />
      {stages.map((stage, i) => (
        <WithTooltip key={stage.id} label={stageLabel(stage)}>
          <div
            role="columnheader"
            // Focusable, so the keyboard can show its tooltip.
            tabIndex={0}
            className={cn(
              'flex items-center justify-center truncate px-[var(--cell-pad-x)] text-center font-semibold',
              PIN_TOP,
            )}
            style={{ ...style, gridColumn: String(columns[i]) }}
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
