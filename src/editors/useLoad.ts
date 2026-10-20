/**
 * Run an async load on demand (a button, not on every render) and track
 * its result, error and progress. A newer load supersedes an older one.
 * `useLoadFor` ties a result to what it was loaded with (a credential, a
 * region), hiding it once that changes.
 *
 * @module
 */
import { isEqual } from 'radash';
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

/** A result and the context it was loaded with. */
export interface Loaded<C, T> {
  context: C;
  value: T;
}

/** A load for `context` (e.g. the chosen credential): the load gets the
 * context it started with, and a result for any other context reads as
 * idle, so changing the context hides results until they are loaded
 * again. */
export function useLoadFor<C, T>(
  context: C,
): [LoadState<Loaded<C, T>>, (load: (context: C) => Promise<T>) => void] {
  const [state, run] = useLoad<Loaded<C, T>>();
  const shown: LoadState<Loaded<C, T>> =
    state.kind === 'done' && !isEqual(state.value.context, context)
      ? { kind: 'idle' }
      : state;
  return [
    shown,
    (load) => {
      const started = context;
      run(async () => ({ context: started, value: await load(started) }));
    },
  ];
}
