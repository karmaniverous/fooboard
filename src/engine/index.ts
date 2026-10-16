/**
 * Public surface of the board engine (spec.md §8 step 7), consumed by the
 * board UI: the engine factory, its model types, and the demo providers
 * that drive *Try the demo* (C-23).
 *
 * Listed as a knip `entry` point until the board UI (PR C) consumes it.
 *
 * @module
 */
export { demoProviders } from './demoProviders';
export { type BoardEngine, createBoardEngine } from './engine';
export {
  ACTIVE_INTERVAL_MS,
  IDLE_INTERVAL_MS,
  type Timers,
  type Visibility,
} from './scheduler';
export {
  type BoardCell,
  type BoardModel,
  cellKey,
  type CompareDetail,
  type EngineProviders,
  type UnmappedRun,
} from './types';
