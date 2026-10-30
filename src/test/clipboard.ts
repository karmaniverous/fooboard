/**
 * For tests: a clipboard that records what is copied (or refuses), and a
 * click that waits for `copyText` to report.
 *
 * @module
 */
import { act, fireEvent } from '@testing-library/react';
import { type Mock, vi } from 'vitest';

/** Give `navigator` a clipboard whose `writeText` resolves (or, with
 * `refuse`, rejects); returns `writeText`. Undo with `unmockClipboard`. */
export function mockClipboard(
  refuse = false,
): Mock<(text: string) => Promise<void>> {
  const writeText = vi.fn<(text: string) => Promise<void>>(() =>
    refuse ? Promise.reject(new Error('refused')) : Promise.resolve(),
  );
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  });
  return writeText;
}

/** Take the clipboard `mockClipboard` gave away. */
export function unmockClipboard(): void {
  Reflect.deleteProperty(navigator, 'clipboard');
}

/** Click `element`, then let `copyText`'s promise chain settle. */
export async function clickToCopy(element: Element): Promise<void> {
  await act(async () => {
    fireEvent.click(element);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}
