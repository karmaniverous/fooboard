/**
 * Copy text to the clipboard, then say whether it worked: an insecure
 * page has no clipboard, and the browser may refuse.
 *
 * @module
 */

/** Copy `text`, then tell `onCopied` whether it was copied (never a
 * throw). */
export function copyText(
  text: string,
  onCopied: (copied: boolean) => void,
): void {
  Promise.resolve()
    .then(() => navigator.clipboard.writeText(text))
    .then(
      () => {
        onCopied(true);
      },
      () => {
        onCopied(false);
      },
    );
}
