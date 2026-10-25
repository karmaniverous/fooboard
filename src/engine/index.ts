/**
 * Public surface of the board model (spec.md §3.1), consumed by the board
 * UI: the model factory and its types.
 *
 * @module
 */
export { type BoardModelHandle, createBoardModel } from './boardModel';
export { emptyModel, githubCredentialIds } from './model';
export {
  type BoardCell,
  type BoardModel,
  cellKey,
  CellKeySchema,
  type UnmappedRun,
} from './types';
