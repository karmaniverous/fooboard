/**
 * Public surface of the board model (spec.md §3.1), consumed by the board
 * UI: the model factory, its types, the store-backed and demo providers.
 *
 * @module
 */
export { type BoardModelHandle, createBoardModel } from './boardModel';
export { demoProviders } from './demoProviders';
export { emptyModel, githubCredentialIds } from './model';
export {
  type BoardCell,
  type BoardModel,
  cellKey,
  CellKeySchema,
  type UnmappedRun,
} from './types';
