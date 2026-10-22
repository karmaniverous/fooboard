/**
 * Act guard: a React "not wrapped in act(...)" warning fails the test that
 * logged it. Each warning still reaches the console as React wrote it (this
 * records, it does not silence), and the test's after hook then throws, so a
 * state update the test never awaited cannot slip back in unnoticed.
 *
 * @module
 */

/** What React's act warnings (state updates, suspended resources) contain. */
const ACT_WARNING = /not wrapped in act\(/;

/** A console format placeholder (React passes the component name as one). */
const PLACEHOLDER = /%[sdio]/;

/** A console call's text: its format string with the arguments filled in. */
function consoleText([first, ...rest]: unknown[]): string {
  if (typeof first !== 'string') return '';
  return rest.reduce<string>(
    (text, arg) => text.replace(PLACEHOLDER, String(arg)),
    first,
  );
}

/** Act warnings logged since the last check. */
const pending: string[] = [];

/**
 * Wraps `target.error` (the global console by default) to record act
 * warnings, passing every call through unchanged.
 */
export function watchActWarnings(
  target: Pick<Console, 'error'> = console,
): void {
  const original = target.error.bind(target);
  target.error = (...args: unknown[]) => {
    const text = consoleText(args);
    if (ACT_WARNING.test(text)) pending.push(text.split('\n')[0] ?? '');
    original(...args);
  };
}

/**
 * Throws if act warnings were logged since the last call (and forgets them).
 */
export function assertNoActWarnings(): void {
  if (pending.length === 0) return;
  const found = pending.splice(0);
  throw new Error(
    `React act(...) warning${found.length === 1 ? '' : 's'}: wrap the ` +
      `update in act(...) or await it (findBy*, waitFor).\n${found.join('\n')}`,
  );
}
