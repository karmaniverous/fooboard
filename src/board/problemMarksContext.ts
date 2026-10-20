/**
 * The board's problem marks, for the headers and cells that show them
 * (spec.md A§4.3.7), without threading them through the viewport, and
 * what clicking a marker does (opens the editor at the problem; absent
 * where there is no editor, e.g. the demo).
 *
 * @module
 */
import { createContext, useContext } from 'react';

import type { Problem } from '@/domain/problems/problem';

import type { ProblemMarks } from './problemMarks';

export interface ProblemMarksValue extends ProblemMarks {
  onOpen?: (problem: Problem) => void;
}

const NONE: ProblemMarksValue = {
  rows: new Map(),
  stages: new Map(),
  cells: new Map(),
  dashboard: [],
};

export const ProblemMarksContext = createContext<ProblemMarksValue>(NONE);

export const useProblemMarks = (): ProblemMarksValue =>
  useContext(ProblemMarksContext);
