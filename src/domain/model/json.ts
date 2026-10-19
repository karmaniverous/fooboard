/**
 * Raw data as plain JSON (spec.md A§4.3.7): readers hand rules JSON
 * values only, so dates become ISO strings and `undefined` fields go.
 * Pure.
 *
 * @module
 */
import type { JSONValue } from 'json-p3';

function isJson(value: unknown): value is JSONValue {
  if (value === null) return true;
  if (['string', 'number', 'boolean'].includes(typeof value)) return true;
  if (Array.isArray(value)) return value.every(isJson);
  return typeof value === 'object' && Object.values(value).every(isJson);
}

/** `value` as JSON, through a JSON round trip (`Date`s to ISO strings). */
export function asJson(value: unknown): JSONValue {
  if (value === undefined) return null;
  const parsed: unknown = JSON.parse(JSON.stringify(value));
  if (!isJson(parsed)) throw new Error('not JSON');
  return parsed;
}
