/**
 * What the share and import dialogs say (spec.md §3.8), in one place so
 * the dialogs and their tests agree.
 *
 * @module
 */
import { NEWER_VERSION_MESSAGE } from '@/domain/config/migrate';

import type { Share, ShareRefused } from '../envelope';
import { SHARE_LINK_MAX_CHARS, X_LINK_MAX_CHARS } from '../link';
import type { SecretAnswer } from '../secretQuestions';

/** Where a share came from, as the import dialog names it: a link
 * (opened or pasted), a file, or a share's JSON text pasted in, which is
 * neither (spec 0.2.0 §3.J). */
export type ShareOrigin = 'link' | 'file' | 'share';

const count = (n: number) => n.toLocaleString('en-US');

/** The status line for a link too long to offer. */
export const tooLongForLink = (length: number): string =>
  `This link would be ${count(length)} characters, more than the ${count(SHARE_LINK_MAX_CHARS)} a link can hold. Download a file instead.`;

/** The note under *Post this board on X*. */
export const postNote = (length: number): string =>
  length <= X_LINK_MAX_CHARS
    ? 'A post on X carries the link without credentials, but the link reveals repo and branch names.'
    : `Too long to post on X: the link is ${count(length)} characters, and X links up to ${count(X_LINK_MAX_CHARS)}.`;

/** The import dialog's error state for a refused share: a newer one's
 * own message; over a list of issues, that it has problems (spec 0.2.0
 * §3.J); else that it isn't a board or is damaged. */
export const refusalMessage = (
  { reason, issues }: Pick<ShareRefused, 'reason' | 'issues'>,
  origin: ShareOrigin,
): string => {
  if (reason === 'newer') return `This ${origin} was ${NEWER_VERSION_MESSAGE}.`;
  return issues.length > 0
    ? `This ${origin} has problems fooboard can't import:`
    : `This ${origin} isn't a fooboard board, or it's damaged.`;
};

/** How many of a refusal's issues the import dialog lists; *Copy errors
 * for your assistant* copies them all (spec 0.2.0 §3.J). */
export const IMPORT_ISSUES_SHOWN = 20;

/** Under the listed issues, when there are more. */
export const moreIssues = (n: number): string => `and ${count(n)} more`;

/** The button that copies a refusal's issues. */
export const COPY_ERRORS = 'Copy errors for your assistant';

/** The line copied above a refusal's issues, so the assistant knows what
 * they are. */
export const ISSUES_PREAMBLE =
  "fooboard's import refused the share with these errors (path: message); please correct the share:";

/** The hint under a refused (damaged or foreign) share. */
export const refusalHint = (origin: ShareOrigin): string =>
  ({
    link: 'Ask whoever sent it for a new link, or for a file.',
    file: 'Ask whoever sent it for a new file.',
    share: 'Ask whoever gave it to you for a new one.',
  })[origin];

/** Under the dashboards when one already here will be replaced. */
export const REPLACE_MINE_NOTE =
  'Replace mine updates the dashboard already here to this version, overwriting any changes you made to it on this device. Its credentials stay. Keep as a copy leaves yours as it is.';

const ASKS_IF_DIFFERENT =
  "You choose for any whose secret differs from this device's.";

/** Under the credentials when *Remember on this device* is ticked. */
export const REMEMBER_NOTE = `The credentials are kept in this browser until you forget them. ${ASKS_IF_DIFFERENT}`;

/** Under the credentials when *Remember on this device* is unticked. */
export const TAB_ONLY_NOTE = `The credentials are kept for this tab only, until it closes. Any this browser already remembers, unchanged, stay remembered. ${ASKS_IF_DIFFERENT}`;

/** Above the questions about secrets that differ (Decision 70). */
export const SECRETS_DIFFER =
  "For the credentials below, this share holds a different secret from this device's. Neither is shown. Choose for each one; the share's follows Remember on this device.";

/** Each question about a secret that differs, after the credential's
 * kind and label. */
export const SECRET_QUESTION = 'keep yours, or use the one in this share?';

/** The answers to each question about a secret that differs. */
export const SECRET_ANSWERS = [
  { value: 'mine', label: 'Keep yours' },
  { value: 'theirs', label: "Use the share's" },
] as const satisfies readonly { value: SecretAnswer; label: string }[];

/** Why *Import* is disabled while a question is unanswered. */
export const ANSWER_TO_IMPORT =
  "Choose Keep yours or Use the share's for each credential above to import.";

/** What a share holds, above the import dialog's choices. */
export function shareSummary(share: Share, origin: ShareOrigin): string {
  const n = share.dashboards.length;
  const dashboards = n === 1 ? '1 dashboard' : `${String(n)} dashboards`;
  const credentials = {
    none: '',
    plain: ' and credentials',
    encrypted: ' and credentials encrypted with a passphrase',
  }[share.credentials.kind];
  return `This ${origin} holds ${dashboards}${credentials}.`;
}

/** Said when the passphrase doesn't open the credentials. */
export const WRONG_PASSPHRASE =
  "That passphrase doesn't open these credentials";

/** Said when the credentials open but can't be read. */
export const DAMAGED_CREDENTIALS =
  'These credentials are damaged. Untick them to import the dashboards alone.';
