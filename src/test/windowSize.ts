/**
 * Test helper: give the window a width (`documentElement.clientWidth`)
 * and a height (`innerHeight`), as a resize would, and tell its `resize`
 * listeners. `restore` puts jsdom's own back.
 *
 * @module
 */
import { act, fireEvent } from '@testing-library/react';

export interface FakeWindowSize {
  /** Resize the window (either side, or neither) and fire `resize`. */
  resize: (size: { width?: number; height?: number }) => void;
  restore: () => void;
}

export function fakeWindowSize(): FakeWindowSize {
  const root = document.documentElement;
  const targets = [
    [window, 'innerHeight'],
    [root, 'clientWidth'],
  ] as const;
  const saved = targets.map(
    ([target, key]) =>
      [target, key, Object.getOwnPropertyDescriptor(target, key)] as const,
  );
  const set = (target: object, key: string, value: number) => {
    Object.defineProperty(target, key, { configurable: true, value });
  };
  return {
    resize({ width, height }) {
      act(() => {
        if (width !== undefined) set(root, 'clientWidth', width);
        if (height !== undefined) set(window, 'innerHeight', height);
        fireEvent(window, new Event('resize'));
      });
    },
    restore() {
      for (const [target, key, original] of saved) {
        if (original) Object.defineProperty(target, key, original);
        else Reflect.deleteProperty(target, key);
      }
    },
  };
}
