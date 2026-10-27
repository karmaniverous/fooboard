/**
 * The smoke tests' `test`, guarding every page (spec.md §3.10, Decisions
 * 40 and 53): a request to any host but the app's own is aborted and
 * recorded, and so is every CSP violation the page reports (its
 * `securitypolicyviolation` events, and console messages naming the
 * policy); a test fails if either list isn't empty when it ends.
 *
 * @module
 */
import { expect, type Page, test as base } from '@playwright/test';

/** What a page did that it mustn't. */
export interface Guard {
  /** Requests to another host (aborted). */
  offHost: string[];
  /** CSP violations reported. */
  violations: string[];
}

/** Records CSP violations; the page calls it from its listener. */
const REPORT = '__fooboardCspViolation';

/** Watch `page`; the lists fill as it runs. */
export async function guard(page: Page, own: string): Promise<Guard> {
  const found: Guard = { offHost: [], violations: [] };
  await page.exposeFunction(REPORT, (text: string) => {
    found.violations.push(text);
  });
  await page.addInitScript(
    `document.addEventListener('securitypolicyviolation', (e) => {
      window.${REPORT}(e.violatedDirective + ' ' + e.blockedURI);
    });`,
  );
  page.on('console', (message) => {
    if (/content.security.policy/i.test(message.text()))
      found.violations.push(message.text());
  });
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
    async ({ page, baseURL }, use) => {
      const found = await guard(page, new URL(baseURL ?? '').origin);
      await use(found);
      expect(found.offHost, 'requests to another host').toEqual([]);
      expect(found.violations, 'CSP violations').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
