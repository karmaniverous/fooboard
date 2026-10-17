/**
 * Run an async load on demand (a button, not on every render) and track
 * its result, error and progress. A newer load supersedes an older one.
 *
 * @module
 */
import { useRef, useState } from 'react';

import { describeError } from '@/lib/errors';

export type LoadState<T> =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'done'; value: T }
  | { kind: 'error'; message: string };

export function useLoad<T>(): [LoadState<T>, (load: () => Promise<T>) => void] {
  const [state, setState] = useState<LoadState<T>>({ kind: 'idle' });
  const latest = useRef(0);
  const run = (load: () => Promise<T>) => {
    const ticket = ++latest.current;
    setState({ kind: 'loading' });
    load().then(
      (value) => {
        if (ticket === latest.current) setState({ kind: 'done', value });
      },
      (err: unknown) => {
        if (ticket === latest.current) {
          setState({ kind: 'error', message: describeError(err) });
        }
      },
    );
  };
  return [state, run];
}
