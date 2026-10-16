/**
 * Domain barrel: config schemas, matching primitives and cell derivation
 * (spec.md §8 PR A). Pure TypeScript, no React, no network, no storage.
 * Kept as a knip entry point since nothing outside `src/domain` consumes it
 * yet (the UI is built in later PRs).
 *
 * @module
 */
export * from './config';
export * from './derivation';
export * from './matching';
