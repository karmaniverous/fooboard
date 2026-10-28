/**
 * The transport every reader sends through (spec.md §3.14 *Injection
 * point*, Decision 53): a `fetch` function and the GitHub API base. A real
 * board uses the browser's `fetch` and GitHub's public API; the demo uses
 * the simulator's `fetch` and the same base, so the readers, the SDK's
 * signing and parsing, the query layer and the budget run unchanged. The
 * GitHub client sends to `githubApiBase` with `fetch`; the Amplify reader's
 * SDK client sends each signed request through `fetch`. Nothing patches
 * the global `fetch`, and no service worker is involved.
 *
 * @module
 */

/** GitHub's REST API (the base every GitHub path is joined to). */
export const GITHUB_API_BASE = 'https://api.github.com';

/** Where the readers send their requests. */
export interface Transport {
  /** Sends one request; the browser's `fetch` on a real board. */
  fetch: typeof fetch;
  /** The GitHub REST API base URL, without a trailing `/`. */
  githubApiBase: string;
}

/** A real board's: the browser's `fetch` (called unbound, as it requires)
 * and GitHub's public API. */
export const browserTransport: Transport = {
  fetch: (input, init) => fetch(input, init),
  githubApiBase: GITHUB_API_BASE,
};
