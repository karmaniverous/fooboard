/**
 * Which cell status a document takes (spec.md A§4.3.6): the first in the
 * set whose test matches, or none (the cell shows Unknown). Tests are JSON
 * Schema 2020-12, checked by `@cfworker/json-schema`, which never uses
 * `eval`, so it runs under the page's security policy (C-7). Validators are
 * compiled once per test object.
 *
 * @module
 */
import { type Schema, Validator } from '@cfworker/json-schema';

import type { CellStatus, StatusSet } from '@/domain/config/statusSets';

const validators = new WeakMap<object, Validator>();

/** A JSON Schema object (the validator rejects what isn't one when it
 * checks a document, so a structural test is enough here). */
const isSchema = (test: object): test is Schema => !Array.isArray(test);

function validatorFor(test: Record<string, unknown>): Validator | undefined {
  let validator = validators.get(test);
  if (!validator && isSchema(test)) {
    validator = new Validator(test, '2020-12', true);
    validators.set(test, validator);
  }
  return validator;
}

/** Does `doc` pass `test`? A test that can't be compiled or run (a bad
 * pattern, say) matches nothing. */
export function passes(test: Record<string, unknown>, doc: unknown): boolean {
  try {
    return validatorFor(test)?.validate(doc).valid ?? false;
  } catch {
    return false;
  }
}

/** The first cell status in `set` that `doc` passes, if any. */
export function classify(
  doc: unknown,
  set: Pick<StatusSet, 'cell'>,
): CellStatus | undefined {
  return set.cell.find((status) => passes(status.test, doc));
}
