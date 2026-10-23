/**
 * Render inside a query environment: each render gets a fresh test
 * environment over `providers` (no credentials by default), kept across
 * `rerender`, so components reading `useQueryEnv` work and no test sees
 * another's cache.
 *
 * @module
 */
import {
  render,
  type RenderOptions,
  type RenderResult,
} from '@testing-library/react';

import { type TestProviders, testQueryEnv, withEnv } from './queryEnv';

/** No secret entered for any credential. */
const NO_CREDENTIALS: TestProviders = {
  github: () => undefined,
  amplify: () => undefined,
};

/** Testing Library's `render`, inside a query environment. */
type EnvRender = (
  ui: React.ReactElement,
  options?: RenderOptions,
) => RenderResult;

/** A `render` wrapping each UI in a fresh environment over `providers`. */
export const envRender =
  (providers: TestProviders = NO_CREDENTIALS): EnvRender =>
  (ui: React.ReactElement, options: RenderOptions = {}) =>
    render(ui, { wrapper: withEnv(testQueryEnv(providers)), ...options });
