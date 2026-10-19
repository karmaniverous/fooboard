/**
 * Which GitHub runs are kept before placement (spec.md A§4.3.7): pull-
 * request runs are dropped when the source rule's reader says so, and the
 * workflow filter applies until it moves into the source rule's *keep*.
 * Pure.
 *
 * @module
 */
import type { MappingSettings } from '@/domain/config/mappingSettings';
import { matchesAny } from '@/domain/matching/matchTest';

const EXCLUDED_EVENTS = new Set(['pull_request', 'pull_request_target']);

/** Is this a pull-request run, which fooboard never maps (spec.md §4.3.2)? */
export function isExcludedEvent(event: string): boolean {
  return EXCLUDED_EVENTS.has(event);
}

/** Does this run pass the workflow filter (spec.md §4.3.1: empty `include`
 * means include all; empty `exclude` excludes nothing)? */
export function passesWorkflowFilter(
  workflowName: string,
  mapping: MappingSettings,
): boolean {
  const context = { jobName: '', workflowName };
  const included = matchesAny(mapping.workflowFilter.include, context, true);
  const excluded = matchesAny(mapping.workflowFilter.exclude, context, false);
  return included && !excluded;
}
