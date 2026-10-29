/**
 * The app's own addresses (spec.md §2.16): the home page, the demo and a
 * saved dashboard's page, named once for the router, the test routers and
 * every link to them (tests that check an address keep it literal).
 * The first run's are in `firstRun/paths.ts`.
 *
 * @module
 */

/** The home page, which lists the dashboards. */
export const HOME_PATH = '/';

/** The demo board (spec.md §3.14). */
export const DEMO_PATH = '/demo';

/** Where saved dashboards' pages live, each under its id. */
const DASHBOARD_BASE = '/d';

/** The router's pattern for a saved dashboard's page. */
export const DASHBOARD_ROUTE = `${DASHBOARD_BASE}/:id`;

/** Saved dashboard `id`'s page. */
export const dashboardPath = (id: string): string => `${DASHBOARD_BASE}/${id}`;
