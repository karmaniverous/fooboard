/**
 * What the share and import dialogs say (spec.md §3.8), in one place so
 * the dialogs and their tests agree.
 *
 * @module
 */
import { NEWER_VERSION_MESSAGE } from '@/domain/config/migrate';

import type { Share, ShareRefusal } from '../envelope';
import { SHARE_LINK_MAX_CHARS, X_LINK_MAX_CHARS } from '../link';
import type { SecretAnswer } from '../secretQuestions';

/** Where a share came from. */
export type ShareOrigin = 'link' | 'file';

const count = (n: number) => n.toLocaleString('en-US');

/** The status line for a link too long to offer. */
export const tooLongForLink = (length: number): string =>
  `This link would be ${count(length)} characters, more than the ${count(SHARE_LINK_MAX_CHARS)} a link can hold. Download a file instead.`;

/** The note under *Post this board on X*. */
export const postNote = (length: number): string =>
  length <= X_LINK_MAX_CHARS
    ? 'A post on X carries the link without credentials, but the link reveals repo and branch names.'
    : `Too long to post on X: the link is ${count(length)} characters, and X links up to ${count(X_LINK_MAX_CHARS)}.`;

/** The import dialog's error state for a refused share. */
export const refusalMessage = (
  reason: ShareRefusal,
  origin: ShareOrigin,
): string =>
  reason === 'newer'
    ? `This ${origin} was ${NEWER_VERSION_MESSAGE}.`
    : `This ${origin} isn't a fooboard board, or it's damaged.`;

/** The hint under a refused (damaged or foreign) share. */
export const refusalHint = (origin: ShareOrigin): string =>
  origin === 'link'
    ? 'Ask whoever sent it for a new link, or for a file.'
    : 'Ask whoever sent it for a new file.';

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
  "This share's secret differs from the one this device holds for the credentials below. Neither is shown. Choose for each one; the share's follows Remember on this device.";

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
