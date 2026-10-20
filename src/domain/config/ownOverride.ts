/**
 * Overrides keyed by stage id (spec.md C-14c). Pure; no imports, so any
 * schema module can use it.
 *
 * @module
 */

/** An override set for `stageId` itself, never one inherited from
 * `Object.prototype` (a stage may be called `constructor`). */
export const ownOverride = <T>(
  overrides: Readonly<Partial<Record<string, T>>>,
  stageId: string,
): T | undefined =>
  Object.hasOwn(overrides, stageId) ? overrides[stageId] : undefined;
