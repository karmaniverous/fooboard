/**
 * Record key names that mean something beyond one rule (spec.md A§4.3.7):
 * the reserved keys the board shows, a record's own `items` and `_raw`,
 * the conformed keys and `state` values the built-in source rules give
 * (and the bundled status sets read), and the paths that select them.
 * Pure constants.
 *
 * @module
 */
import { pathStep, ROOT_PATH } from '@/domain/rules/path';

/** Reserved, optional record keys the board shows when present (`time`
 * and `link` are reserved on items too). */
export const RESERVED_KEYS = {
  time: 'time',
  link: 'link',
  message: 'message',
  commit: 'commit',
  branch: 'branch',
} as const;

/** What translation adds to every record: its items (when the source rule
 * has an items path) and the raw data it came from. */
export const RECORD_KEYS = { items: 'items', raw: '_raw' } as const;

/** The other keys the built-in source rules give: a GitHub run's workflow
 * and event, a job's name, and the conformed `state`. */
export const BUILTIN_KEYS = {
  workflow: 'workflow',
  event: 'event',
  name: 'name',
  state: 'state',
} as const;

/** The conformed `state` values the built-in source rules give. */
export const STATES = {
  failed: 'failed',
  cancelled: 'cancelled',
  running: 'running',
  queued: 'queued',
  succeeded: 'succeeded',
  skipped: 'skipped',
} as const;

/** The path to the record's (or, at item scope, the item's) `key`. */
export const keyPath = (key: string): string => `${ROOT_PATH}${pathStep(key)}`;

/** Inside a filter, the path to the current item's `key`. */
export const relativeKeyPath = (key: string): string => `@${pathStep(key)}`;

/** The path step selecting every element of an array. */
export const WILDCARD_STEP = '[*]';

/** The path to every item of a record. */
export const ITEMS_PATH = `${keyPath(RECORD_KEYS.items)}${WILDCARD_STEP}`;

/** The path to item key `key` across a record's items. */
export const itemKeyPath = (key: string): string =>
  `${ITEMS_PATH}${pathStep(key)}`;

/** The path to the items for which the JSONPath `filter` holds. */
export const itemsFilterPath = (filter: string): string =>
  `${keyPath(RECORD_KEYS.items)}[?${filter}]`;

/** The path a new field starts from before a key is picked. */
export const NEW_FIELD_PATH = `${ROOT_PATH}.`;

/** The path a new item-rule check starts from: the item's name. */
export const ITEM_NAME_PATH = keyPath(BUILTIN_KEYS.name);
