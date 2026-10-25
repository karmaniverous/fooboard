/**
 * Whether the user asks for reduced motion
 * (`prefers-reduced-motion: reduce`), following changes. False where the query isn't available.
 *
 * @module
 */
import { useMediaQuery } from './useMediaQuery';

const QUERY = '(prefers-reduced-motion: reduce)';

export function usePrefersReducedMotion(): boolean {
  return useMediaQuery(QUERY);
}
