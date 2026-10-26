/**
 * Saving JSON as a file download from the page (no server involved).
 *
 * @module
 */

/** Save JSON `text` as a download named `name`. */
export function download(text: string, name: string): void {
  const url = URL.createObjectURL(
    new Blob([text], { type: 'application/json' }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  // After the click has handed the file over (revoking at once can cancel
  // the download in some browsers).
  setTimeout(() => {
    URL.revokeObjectURL(url);
  });
}
