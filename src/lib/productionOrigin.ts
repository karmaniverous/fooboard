/**
 * Production's origin, on its own with no browser globals, so the Vite
 * config's plugins (`vite/demoPage.ts`) read it as well as the app.
 *
 * @module
 */

/** Production's origin: the canonical host, and the only fooboard site an
 * AI assistant can reach (dev and release are password-protected, and the
 * bare domain only redirects here; spec 0.2.0 §3.J, Decisions 96 and
 * 107). Every canonical address crawlers are given is on it (§3.K). */
export const PRODUCTION_ORIGIN = 'https://www.fooboard.dev';
