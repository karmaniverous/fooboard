import { describe, expect, it } from 'vitest';

import { FIRST_ID_SUFFIX, freshId } from './ids';

describe('freshId', () => {
  it('keeps a free base', () => {
    expect(freshId('dev', ['prod'])).toBe('dev');
  });

  it('suffixes a taken base with the first free number', () => {
    expect(freshId('dev', ['dev'])).toBe(`dev-${String(FIRST_ID_SUFFIX)}`);
    expect(
      freshId('dev', new Set(['dev', `dev-${String(FIRST_ID_SUFFIX)}`])),
    ).toBe(`dev-${String(FIRST_ID_SUFFIX + 1)}`);
  });
});
