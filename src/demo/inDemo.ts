/**
 * Whether a view is the demo's (spec.md §3.14 *Board and edits*): the
 * demo's dashboard lives in memory for the tab, so what acts on saved
 * dashboards (duplicate, delete) isn't offered there.
 *
 * @module
 */
import { createContext, use } from 'react';

/** `true` inside the demo. */
export const InDemoContext = createContext(false);

/** Whether this view is the demo's. */
export const useInDemo = (): boolean => use(InDemoContext);
