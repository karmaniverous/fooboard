/**
 * The user-facing docs promise only what is built (spec.md Decision 20
 * item 5): README and PRIVACY.md don't offer *Reset*, which N3 builds;
 * until then, clearing the site's data is the way to remove everything.
 * N3 restores the wording and this test with it.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import privacy from '../PRIVACY.md?raw';
import readme from '../README.md?raw';

describe('docs', () => {
  it.each([
    ['README.md', readme],
    ['PRIVACY.md', privacy],
  ])('%s offers no Reset, only clearing the site data', (_name, text) => {
    expect(text).not.toMatch(/\bReset\b/);
    expect(text).toMatch(/clear[^.]*site's data/i);
  });
});
