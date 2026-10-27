/**
 * *Report an issue*'s prefilled issue (spec.md §3.10, Decision 25): the
 * version, the browser and the error message, cleaned of anything shaped
 * like a secret or a board's names, and nothing else.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import {
  cleanErrorMessage,
  ISSUE_MESSAGE_MAX,
  issueText,
  issueUrl,
} from './issueReport';
import { site } from './site';

const ORIGIN = 'https://www.fooboard.dev';

describe('cleanErrorMessage', () => {
  it.each([
    [
      'a classic token',
      'bad ghp_abcdefghijklmnopqrstuvwxyz0123456789',
      'bad <token>',
    ],
    ['an OAuth token', 'Bearer gho_abcDEF123', 'Bearer <token>'],
    ['a fine-grained token', 'github_pat_11AAAA_bbbb', '<token>'],
    [
      'an AWS key id',
      'key AKIAABCDEFGHIJKLMNOP denied',
      'key <aws-key-id> denied',
    ],
    ['a temporary AWS key id', 'ASIAABCDEFGHIJKLMNOP', '<aws-key-id>'],
    [
      'an AWS secret',
      'secret wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      'secret <redacted>',
    ],
    [
      'a commit SHA',
      'at 0123456789abcdef0123456789abcdef01234567',
      'at <redacted>',
    ],
    ['an email address', 'from dev@acme.example.com', 'from <email>'],
    [
      'a link to another site',
      'GET https://api.github.com/repos/acme/billing/actions/runs?page=2 failed',
      'GET <url> failed',
    ],
    [
      'a GitHub repo path',
      'Not found: /repos/acme/billing/actions/runs',
      'Not found: /repos/<owner>/<repo>/actions/runs',
    ],
    [
      'an Amplify app id',
      'no app /apps/d1a2b3c4/branches',
      'no app /apps/<app>/branches',
    ],
  ])('removes %s', (_, message, cleaned) => {
    expect(cleanErrorMessage(message, ORIGIN)).toBe(cleaned);
  });

  it("keeps a link to the app's own file, without its query or fragment", () => {
    expect(
      cleanErrorMessage(
        `Failed to fetch dynamically imported module: ${ORIGIN}/assets/DemoPage-Bx1aQ2c3dE4fG5hI6jK7lM8nO9pQ0rS1.js?v=1#x`,
        ORIGIN,
      ),
    ).toBe(
      `Failed to fetch dynamically imported module: ${ORIGIN}/assets/DemoPage-Bx1aQ2c3dE4fG5hI6jK7lM8nO9pQ0rS1.js`,
    );
  });

  it('treats a look-alike host as another site', () => {
    expect(cleanErrorMessage(`${ORIGIN}.evil.example/x?t=1`, ORIGIN)).toBe(
      '<url>',
    );
  });

  it('keeps an ordinary message as it is', () => {
    const message =
      "TypeError: Cannot read properties of undefined (reading 'rows')";
    expect(cleanErrorMessage(message, ORIGIN)).toBe(message);
  });

  it(`cuts a long message to ${String(ISSUE_MESSAGE_MAX)} characters`, () => {
    const cleaned = cleanErrorMessage('word '.repeat(200), ORIGIN);
    expect(cleaned).toHaveLength(ISSUE_MESSAGE_MAX);
    expect(cleaned.endsWith('…')).toBe(true);
    expect(cleanErrorMessage('x'.repeat(10), ORIGIN)).toBe('x'.repeat(10));
  });
});

describe('issueText', () => {
  const report = {
    version: '0.1.0',
    browser: 'Mozilla/5.0 (X11; Linux x86_64) Firefox/131.0',
    message: 'TypeError: x is undefined\n    at render',
  };

  it('carries the version, the browser and the message, and nothing else', () => {
    const { title, body } = issueText(report);
    expect(title).toBe('Error: TypeError: x is undefined');
    expect(body).toContain('**fooboard version:** 0.1.0');
    expect(body).toContain(`**Browser:** ${report.browser}`);
    expect(body).toContain(`\`\`\`\n${report.message}\n\`\`\``);
  });

  it('cuts a long first line in the title', () => {
    const { title } = issueText({ ...report, message: 'e'.repeat(100) });
    expect(title).toBe(`Error: ${'e'.repeat(79)}…`);
  });

  it("fences the message so its own backticks can't end the block", () => {
    const { body } = issueText({ ...report, message: 'a ```` b' });
    expect(body).toContain('`````\na ```` b\n`````');
  });

  it('links to a new issue in the repo, prefilled', () => {
    const url = new URL(issueUrl(report));
    expect(`${url.origin}${url.pathname}`).toBe(`${site.issuesUrl}/new`);
    expect(Object.fromEntries(url.searchParams)).toEqual(issueText(report));
  });
});
