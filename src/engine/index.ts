/**
 * Public surface of the board engine (spec.md §8 step 7), consumed by the
 * board UI: the engine factory, its model types, and the demo providers
 * that drive *Try the demo* (C-23).
 *
 * @module
 */
export { demoProviders } from './demoProviders';
export { createBoardEngine } from './engine';
export {
  type BoardCell,
  type BoardModel,
  cellKey,
  type EngineProviders,
} from './types';
