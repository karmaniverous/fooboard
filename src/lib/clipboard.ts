/**
 * Copy text to the clipboard, reporting whether it worked: an insecure
 * page has no clipboard, and the browser may refuse.
 *
 * @module
 */

export const copyText = (text: string): Promise<boolean> =>
  Promise.resolve()
    .then(() => navigator.clipboard.writeText(text))
    .then(
      () => true,
      () => false,
    );
