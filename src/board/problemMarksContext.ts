/**
 * The board's problem marks, for the headers that show them (spec.md
 * A§4.3.7), without threading them through the viewport.
 *
 * @module
 */
import { createContext, useContext } from 'react';

import type { ProblemMarks } from './problemMarks';

const NONE: ProblemMarks = { rows: new Map(), stages: new Map() };

export const ProblemMarksContext = createContext<ProblemMarks>(NONE);

export const useProblemMarks = (): ProblemMarks =>
  useContext(ProblemMarksContext);
