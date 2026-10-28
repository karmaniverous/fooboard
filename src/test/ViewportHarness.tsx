/**
 * The board viewport over the 19 x 6 demo board with its saved view, for
 * `renderViewport`.
 *
 * @module
 */
import { BoardViewport } from '@/board/BoardViewport';
import { useBoardView } from '@/board/useBoardView';
import { measureBoard } from '@/demo/scenarios/measure';
import type { BoardModel } from '@/engine';

export function ViewportHarness({
  model,
}: {
  model: BoardModel;
}): React.JSX.Element {
  const view = useBoardView('demo', 19, 6);
  return (
    <BoardViewport dashboard={measureBoard} model={model} now={0} view={view} />
  );
}
