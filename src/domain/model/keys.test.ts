/**
 * Tests for the key paths: they select what they name in a translated
 * record, quoting keys that aren't identifiers.
 *
 * @module
 */
import type { JSONValue } from 'json-p3';
import { describe, expect, it } from 'vitest';

import { compilePath, valuesAt } from '@/domain/rules/path';

import {
  BUILTIN_KEYS,
  itemKeyPath,
  ITEMS_PATH,
  itemsFilterPath,
  keyPath,
  RECORD_KEYS,
  relativeKeyPath,
  STATES,
} from './keys';

const record: JSONValue = {
  [BUILTIN_KEYS.workflow]: 'CI',
  'odd key': 1,
  [RECORD_KEYS.items]: [
    { [BUILTIN_KEYS.name]: 'test', [BUILTIN_KEYS.state]: STATES.failed },
    { [BUILTIN_KEYS.name]: 'deploy', [BUILTIN_KEYS.state]: STATES.succeeded },
  ],
};

const find = (path: string) => {
  const compiled = compilePath(path);
  if (!compiled.ok) throw new Error(compiled.message);
  return valuesAt(compiled.query, record);
};

describe('key paths', () => {
  it('select a record key, quoting one that is not an identifier', () => {
    expect(find(keyPath(BUILTIN_KEYS.workflow))).toEqual(['CI']);
    expect(find(keyPath('odd key'))).toEqual([1]);
  });

  it('select every item, and an item key across them', () => {
    expect(find(ITEMS_PATH)).toHaveLength(2);
    expect(find(itemKeyPath(BUILTIN_KEYS.state))).toEqual([
      STATES.failed,
      STATES.succeeded,
    ]);
  });

  it('select the items a filter on the current item holds for', () => {
    const filter = `${relativeKeyPath(BUILTIN_KEYS.state)} == '${STATES.failed}'`;
    expect(find(itemsFilterPath(filter))).toEqual([
      { [BUILTIN_KEYS.name]: 'test', [BUILTIN_KEYS.state]: STATES.failed },
    ]);
  });
});
