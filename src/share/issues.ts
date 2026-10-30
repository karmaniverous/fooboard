/**
 * Field-level import errors (spec 0.2.0 §3.J *Field-level errors*): what
 * a refused share says is wrong with it, each a path into the share and a
 * message, so an assistant that built it can fix it. Paths are written as
 * an assistant reads them (`dashboards[0].stages[3].id`); an issue about
 * the share as a whole is written `share`. Messages never hold a value
 * from the share's credentials: zod's name what was expected, not what
 * was found, and text that isn't JSON is described by the position of
 * its error alone. Pure.
 *
 * @module
 */
import type { z } from 'zod';

import { jsonErrorAt, lineColumn } from './jsonErrorAt';

/** One thing wrong with a share: where (a written path), and what. */
export interface ShareIssue {
  /** The path into the share (`issuePath`), or `share` for the whole. */
  path: string;
  message: string;
}

/** The path written for an issue about the share as a whole. */
export const WHOLE_SHARE = 'share';

/** A path into the share, as zod gives it, written for a reader: string
 * keys joined by `.`, numbers as `[n]` (`dashboards[0].stages[3].id`);
 * the empty path is the share as a whole. */
export function issuePath(path: readonly PropertyKey[]): string {
  const written = path.reduce<string>(
    (out, key) =>
      typeof key === 'number'
        ? `${out}[${String(key)}]`
        : `${out}${out === '' ? '' : '.'}${String(key)}`,
    '',
  );
  return written === '' ? WHOLE_SHARE : written;
}

/** `path` (zod's) and `message` as an issue. */
export const shareIssue = (
  path: readonly PropertyKey[],
  message: string,
): ShareIssue => ({ path: issuePath(path), message });

/** Each issue of a zod error, at its path under `prefix`. */
export const zodIssues = (
  error: z.ZodError,
  prefix: readonly PropertyKey[] = [],
): ShareIssue[] =>
  error.issues.map((i) => shareIssue([...prefix, ...i.path], i.message));

/** Where `text`, which a parser refused, stops being JSON: its position
 * alone, never any of its text (a parser's own message can quote part of
 * a secret, spec 0.2.0 §3.J *No quoted input in error messages*). */
export function notJsonIssue(text: string): ShareIssue {
  const at = jsonErrorAt(text);
  if (at === undefined)
    return shareIssue([], 'not JSON: the error could not be placed');
  const { line, column } = lineColumn(text, at);
  const where =
    at >= text.length
      ? `it ends too soon, at position ${String(at)}`
      : `the error is at position ${String(at)}`;
  return shareIssue(
    [],
    `not JSON: ${where} (line ${String(line)}, column ${String(column)})`,
  );
}

/** An issue as one line: its path, `: `, then its message. */
export const issueLine = (issue: ShareIssue): string =>
  `${issue.path}: ${issue.message}`;
