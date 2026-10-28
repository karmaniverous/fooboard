/**
 * The act guard records React's act warnings without swallowing them, and
 * fails the check once per batch.
 *
 * @module
 */
import { describe, expect, it, vi } from 'vitest';

import { assertNoActWarnings, watchActWarnings } from './actGuard';

/** React's own warning: a format string with the component as `%s`. */
const REACT_WARNING =
  'An update to %s inside a test was not wrapped in act(...).\n\nWhen testing, ...';

function watchedConsole() {
  const error = vi.fn();
  const target = { error };
  watchActWarnings(target);
  return { log: target.error, error };
}

describe('act guard', () => {
  it('passes every call through unchanged', () => {
    const { log, error } = watchedConsole();
    log(REACT_WARNING, 'Tooltip');
    log('Something else', 42);
    expect(error.mock.calls).toEqual([
      [REACT_WARNING, 'Tooltip'],
      ['Something else', 42],
    ]);
    // Leave nothing behind for this test's own after hook.
    expect(assertNoActWarnings).toThrow();
  });

  it('fails the check with each warning, filled in, then forgets them', () => {
    const { log } = watchedConsole();
    log(REACT_WARNING, 'Tooltip');
    log(REACT_WARNING, 'BoardGrid');
    expect(assertNoActWarnings).toThrow(
      /warnings: .*\nAn update to Tooltip inside .*\nAn update to BoardGrid inside /,
    );
    expect(assertNoActWarnings).not.toThrow();
  });

  it('ignores other errors, and calls not led by a format string', () => {
    const { log } = watchedConsole();
    log('Warning: something unrelated %s', 'x');
    log(new Error('not wrapped in act(...)'));
    expect(assertNoActWarnings).not.toThrow();
  });
});
