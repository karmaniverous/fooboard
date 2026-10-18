/**
 * Tests for classification: the first status whose test passes wins, none
 * passing gives `undefined`, and a test that can't run matches nothing
 * instead of throwing.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import type { CellStatus } from '@/domain/config/statusSets';

import { classify } from './classify';

const status = (id: string, test: Record<string, unknown>): CellStatus => ({
  id,
  name: id,
  color: '#000000',
  summary: 's',
  outlined: false,
  test,
});
const failed = { properties: { status: { const: 'FAILED' } } };

describe('classify', () => {
  it('returns the first status whose test passes', () => {
    const set = { cell: [status('a', failed), status('b', {})] };
    expect(classify({ status: 'FAILED' }, set)?.id).toBe('a');
    expect(classify({ status: 'OK' }, set)?.id).toBe('b');
    expect(
      classify({ status: 'OK' }, { cell: [status('a', failed)] }),
    ).toBeUndefined();
  });

  it('treats a test that cannot run as matching nothing', () => {
    const bad = status('bad', {
      properties: { status: { type: 'string', pattern: '(' } },
    });
    expect(
      classify({ status: 'x' }, { cell: [bad, status('ok', {})] })?.id,
    ).toBe('ok');
  });
});
