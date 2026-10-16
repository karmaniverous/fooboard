/**
 * Tests for `StatusColorsSchema`: only `#rrggbb` hex colors are accepted.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { StatusColorsSchema } from './colors';

describe('StatusColorsSchema', () => {
  it.each(['#15803d', '#ABCDEF'])('accepts %s', (color) => {
    expect(StatusColorsSchema.safeParse({ failure: color }).success).toBe(true);
  });

  it.each(['not-a-color', '#fff', '#12345g', '15803d'])(
    'rejects %s',
    (color) => {
      expect(StatusColorsSchema.safeParse({ success: color }).success).toBe(
        false,
      );
    },
  );
});
