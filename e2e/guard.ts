/**
 * The smoke tests' `test`, guarding every page (spec.md §3.10, Decisions
 * 40 and 53): a request to any host but the app's own is aborted and
 * recorded, and so is every CSP violation the page reports (its
 * `securitypolicyviolation` events); a test fails if either list isn't
 * empty when it ends.
 *
 * One report is WebKit's own, not the page's: WebKit reports
 * `style-src-attr` (`inline`) for every native `<select>` added to the
 * document, styled or not (its built-in styles), and Radix Select adds one
 * for a moment as each Select first renders. In WebKit only, that exact
 * report is left out (recorded in the spec's browser pass).
 *
 * @module
 */
import { expect, type Page, test as base } from '@playwright/test';

/** What a page did that it mustn't. */
export interface Guard {
  /** Requests to another host (aborted). */
  offHost: string[];
  /** CSP violations reported: the directive, then what was blocked. */
  violations: string[];
}

/** Records CSP violations; the page calls it from its listener. */
const REPORT = '__fooboardCspViolation';

/** WebKit's report for its own native `<select>` styles (see the module). */
const WEBKIT_SELECT_REPORT = 'style-src-attr inline';

/** Watch `page`; the lists fill as it runs. */
async function guard(page: Page, own: string, engine: string): Promise<Guard> {
  const found: Guard = { offHost: [], violations: [] };
  await page.exposeFunction(REPORT, (text: string) => {
    if (engine === 'webkit' && text === WEBKIT_SELECT_REPORT) return;
    found.violations.push(text);
  });
  await page.addInitScript(
    `document.addEventListener('securitypolicyviolation', (e) => {
      window.${REPORT}(e.violatedDirective + ' ' + e.blockedURI);
    }, true);`,
  );
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === own) return route.continue();
    found.offHost.push(url.href);
    return route.abort('blockedbyclient');
  });
  return found;
}

export const test = base.extend<{ guarded: Guard }>({
  guarded: [
    async ({ page, baseURL, browserName }, use) => {
      const found = await guard(
        page,
        new URL(baseURL ?? '').origin,
        browserName,
      );
      await use(found);
      expect(found.offHost, 'requests to another host').toEqual([]);
      expect(found.violations, 'CSP violations').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
