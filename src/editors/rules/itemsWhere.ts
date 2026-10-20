/**
 * *Only items where* (spec.md A§4.3.7): a check that some item has a key
 * matching a glob, written as a JSONPath filter. RFC 9535 regexes have no
 * case-insensitive flag, so ignoring case folds each letter into a class
 * (`deploy` → `[Dd][Ee][Pp][Ll][Oo][Yy]`). Pure.
 *
 * @module
 */
import { itemsFilterPath, relativeKeyPath } from '@/domain/model/keys';
import { exists } from '@/domain/model/ruleBuilders';
import { caseClass, quoted } from '@/domain/rules/path';
import type { Check } from '@/domain/rules/schema';

/** A glob as an I-Regexp body (`*` any run, `?` one character). */
function globRegex(glob: string, ignoreCase: boolean): string {
  return Array.from(glob)
    .map((ch) => {
      if (ch === '*') return '.*';
      if (ch === '?') return '.';
      const folded = ignoreCase ? caseClass(ch) : undefined;
      if (folded !== undefined) return folded;
      return /[\\^$.|+()[\]{}]/.test(ch) ? `\\${ch}` : ch;
    })
    .join('');
}

/** The filter path for items whose `key` matches `glob`. */
export function itemsWherePath(
  key: string,
  glob: string,
  ignoreCase: boolean,
): string {
  return itemsFilterPath(
    `match(${relativeKeyPath(key)}, ${quoted(globRegex(glob, ignoreCase))})`,
  );
}

/** A check that some item's `key` matches `glob`. */
export const itemsWhere = (
  key: string,
  glob: string,
  ignoreCase: boolean,
): Check => exists(itemsWherePath(key, glob, ignoreCase));
