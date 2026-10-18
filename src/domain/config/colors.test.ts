/**
 * Tests for `HexColorSchema`: only `#rrggbb` hex colors are accepted.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { HexColorSchema } from './colors';

describe('HexColorSchema', () => {
  it.each(['#15803d', '#ABCDEF'])('accepts %s', (color) => {
    expect(HexColorSchema.safeParse(color).success).toBe(true);
  });

  it.each(['not-a-color', '#fff', '#12345g', '15803d'])(
    'rejects %s',
    (color) => {
      expect(HexColorSchema.safeParse(color).success).toBe(false);
    },
  );
});
