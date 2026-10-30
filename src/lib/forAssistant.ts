/**
 * Text copied for the user's AI assistant (spec 0.2.0 §3.J *The fix
 * loop*): a one-line preamble saying what the list is, then each line,
 * and what the copy button says once it has copied. Pure.
 *
 * @module
 */

/** What the copy for an assistant holds: `preamble`, then each line. */
export const forAssistant = (
  preamble: string,
  lines: readonly string[],
): string => [preamble, ...lines].join('\n');

/** What the button says once it has copied, or couldn't. */
export const copiedNote = (copied: boolean): string =>
  copied
    ? 'Copied. Paste it into your assistant.'
    : "Couldn't copy: this browser refused the clipboard.";
