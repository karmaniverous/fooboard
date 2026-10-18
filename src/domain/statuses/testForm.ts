/**
 * The status-test form (spec.md A§4.3.6): conditions (a field, an operator
 * and a value, on the run or on any or every job), all of which must hold,
 * written as standard JSON Schema. `fromSchema` reads back exactly the
 * shapes `toSchema` writes; anything else (the presets' richer tests, hand
 * edits) is not representable and stays editable as raw JSON. Pure.
 *
 * @module
 */
import { z } from 'zod';

import { caseless, textPattern } from './pattern';
import { all, anyJob, everyJob, has } from './schemaBuilders';

type ConditionScope = 'value' | 'anyJob' | 'everyJob';

type FormOperator =
  'is' | 'oneOf' | 'startsWith' | 'endsWith' | 'contains' | 'regex';

export interface Condition {
  /** `value`: a field of the document itself (the run, Amplify job or, in
   * a job test, the job); `anyJob`/`everyJob`: a field of the run's jobs. */
  scope: ConditionScope;
  field: string;
  operator: FormOperator;
  /** For `oneOf`, comma-separated exact values. */
  value: string;
}

type Schema = Record<string, unknown>;

/** One value test. Text operators ignore case; `oneOf` is exact. */
function valueTest({ operator, value }: Condition): Schema {
  if (operator === 'oneOf')
    return {
      enum: value
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean),
    };
  return { type: 'string', pattern: textPattern(operator, value) };
}

function conditionSchema(c: Condition): Schema {
  const own = has(c.field, valueTest(c));
  if (c.scope === 'value') return own;
  return c.scope === 'anyJob' ? anyJob(own) : everyJob(own);
}

/** All of `conditions` (none: matches anything). */
export const toSchema = (conditions: readonly Condition[]): Schema =>
  all(...conditions.map(conditionSchema));

// --- Reading back ---------------------------------------------------------

const ValueTestSchema = z.union([
  z.strictObject({ enum: z.array(z.string()) }),
  z.strictObject({ type: z.literal('string'), pattern: z.string() }),
]);

const HasSchema = z.strictObject({
  type: z.literal('object'),
  properties: z.record(z.string(), z.unknown()),
  required: z.array(z.string()).length(1),
});

const JobsSchema = z.union([
  z.strictObject({ type: z.literal('array'), contains: z.unknown() }),
  z.strictObject({
    type: z.literal('array'),
    minItems: z.literal(1),
    items: z.unknown(),
  }),
]);

/** The literal text a caseless pattern matches, if it is one. */
function uncaseless(pattern: string): string | undefined {
  const text = pattern.replace(/\[(.)(.)\]|\\(.)/gsu, (_, lo, _up, esc) =>
    typeof esc === 'string' ? esc : String(lo),
  );
  return caseless(text) === pattern ? text : undefined;
}

function readPattern(pattern: string): Pick<Condition, 'operator' | 'value'> {
  const starts = pattern.startsWith('^');
  const ends = pattern.endsWith('$') && !pattern.endsWith('\\$');
  const core = pattern.slice(starts ? 1 : 0, ends ? -1 : undefined);
  const text = uncaseless(core);
  if (text !== undefined) {
    const operator =
      starts && ends
        ? 'is'
        : starts
          ? 'startsWith'
          : ends
            ? 'endsWith'
            : 'contains';
    return { operator, value: text };
  }
  return { operator: 'regex', value: pattern };
}

/** `{ field: test }` read as a field and its value test. */
function readHas(
  schema: unknown,
): { field: string; test: unknown } | undefined {
  const parsed = HasSchema.safeParse(schema);
  if (!parsed.success) return undefined;
  const { properties, required } = parsed.data;
  const field = required.join();
  if (Object.keys(properties).join() !== field) return undefined;
  return { field, test: properties[field] };
}

function readValue(
  schema: unknown,
): Pick<Condition, 'field' | 'operator' | 'value'> | undefined {
  const own = readHas(schema);
  const test = own && ValueTestSchema.safeParse(own.test);
  if (!own || !test?.success) return undefined;
  const t = test.data;
  return {
    field: own.field,
    ...('enum' in t
      ? { operator: 'oneOf', value: t.enum.join(', ') }
      : readPattern(t.pattern)),
  };
}

function readCondition(schema: unknown): Condition | undefined {
  const outer = readHas(schema);
  if (outer?.field === 'jobs') {
    const jobs = JobsSchema.safeParse(outer.test);
    if (jobs.success) {
      const scope = 'contains' in jobs.data ? 'anyJob' : 'everyJob';
      const inner = readValue(
        'contains' in jobs.data ? jobs.data.contains : jobs.data.items,
      );
      return inner && { scope, ...inner };
    }
  }
  const own = readValue(schema);
  return own && { scope: 'value', ...own };
}

/** The conditions `schema` was written from, or `undefined` when the form
 * can't represent it. */
export function fromSchema(schema: unknown): Condition[] | undefined {
  if (z.strictObject({}).safeParse(schema).success) return [];
  const all = z
    .strictObject({ allOf: z.array(z.unknown()).min(2) })
    .safeParse(schema);
  const parts = all.success ? all.data.allOf : [schema];
  const conditions: Condition[] = [];
  for (const part of parts) {
    const c = readCondition(part);
    if (!c) return undefined;
    conditions.push(c);
  }
  return conditions;
}
