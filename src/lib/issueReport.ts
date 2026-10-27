/**
 * *Report an issue* from the error screen (spec.md §3.10, Decision 25): a
 * link to a new GitHub issue prefilled with the app version, the browser
 * and the error message, and nothing else. It takes no board, store or
 * credential: what it carries is only what its caller passes, and the
 * message is cleaned first of anything shaped like a secret or a board's
 * names (tokens and keys, long opaque strings such as SHAs, links to other
 * sites, email addresses, GitHub repo paths and Amplify app ids), then
 * cut to {@link ISSUE_MESSAGE_MAX} characters. Nothing is sent: GitHub
 * shows the issue for the reporter to read, edit and submit.
 *
 * @module
 */
import { site } from './site';

/** What a prefilled issue carries. */
export interface IssueReport {
  /** The app's version. */
  version: string;
  /** The browser (its user agent string). */
  browser: string;
  /** The error's message, cleaned by {@link cleanErrorMessage}. */
  message: string;
}

/** The longest error message a prefilled issue carries. */
export const ISSUE_MESSAGE_MAX = 500;

/** The longest issue title, before the message is cut. */
const TITLE_MAX = 80;

/** Each pattern a message is cleaned of, and what replaces it. Order
 * matters: tokens and keys before the generic long strings. */
const REDACTIONS: readonly (readonly [RegExp, string])[] = [
  [/\b(?:gh[opsur]_|github_pat_)[A-Za-z0-9_]+/gi, '<token>'],
  [/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g, '<aws-key-id>'],
  [/[A-Za-z0-9_.+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g, '<email>'],
  [/\/repos\/[^/\s]+\/[^/\s?#]+/g, '/repos/<owner>/<repo>'],
  [/\/apps\/[^/\s?#]+/g, '/apps/<app>'],
  [/[A-Za-z0-9/+=_-]{32,}/g, '<redacted>'],
];

const URL_PATTERN = /\bhttps?:\/\/[^\s'"`<>)]+/g;

const parseUrl = (url: string): URL | undefined => {
  try {
    return new URL(url);
  } catch {
    return undefined;
  }
};

/** `message` without secrets or a board's names (see the module), links
 * to `origin` (the app's own files) kept without their query or
 * fragment, and cut to {@link ISSUE_MESSAGE_MAX} characters. */
export function cleanErrorMessage(message: string, origin: string): string {
  const urls = message.replace(URL_PATTERN, (url) => {
    const parsed = parseUrl(url);
    return parsed?.origin === origin
      ? `${parsed.origin}${parsed.pathname}`
      : '<url>';
  });
  // Links to the app's own files keep their paths (an asset's hashed name
  // says which build failed to load); everything else is cleaned.
  const cleaned = urls
    .split(/(\s+)/)
    .map((word) =>
      word.startsWith(`${origin}/`)
        ? word
        : REDACTIONS.reduce((w, [pattern, by]) => w.replace(pattern, by), word),
    )
    .join('');
  return cleaned.length > ISSUE_MESSAGE_MAX
    ? `${cleaned.slice(0, ISSUE_MESSAGE_MAX - 1)}…`
    : cleaned;
}

/** A Markdown code fence longer than any backtick run in `text`. */
const fenceFor = (text: string): string =>
  '`'.repeat(
    Math.max(3, ...(text.match(/`+/g) ?? []).map((run) => run.length + 1)),
  );

/** The prefilled issue's title and body. */
export function issueText({ version, browser, message }: IssueReport): {
  title: string;
  body: string;
} {
  const firstLine = message.split('\n')[0] ?? '';
  const title = `Error: ${
    firstLine.length > TITLE_MAX
      ? `${firstLine.slice(0, TITLE_MAX - 1)}…`
      : firstLine
  }`;
  const fence = fenceFor(message);
  const body = [
    '**What were you doing when it happened?**',
    '',
    '',
    '**Error**',
    '',
    fence,
    message,
    fence,
    '',
    `**fooboard version:** ${version}`,
    '',
    `**Browser:** ${browser}`,
    '',
    "_Prefilled by fooboard's error screen with the version, the browser and the error message, and no board data. Check it before you submit._",
  ].join('\n');
  return { title, body };
}

/** The link to a new issue prefilled with `report`. */
export function issueUrl(report: IssueReport): string {
  const { title, body } = issueText(report);
  return `${site.issuesUrl}/new?${new URLSearchParams({ title, body }).toString()}`;
}
