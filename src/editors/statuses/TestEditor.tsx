/**
 * A status test (spec.md A§4.3.6): a form of conditions, all of which must
 * hold, when the test is one the form can write; standard JSON Schema
 * otherwise, or on request. JSON commits on blur and only when it parses
 * to an object.
 *
 * @module
 */
import { useState } from 'react';

import { Choice } from '@/components/Choice';
import { Button } from '@/components/ui/button';
import {
  type Condition,
  fromSchema,
  toSchema,
} from '@/domain/statuses/testForm';

import { CommitInput } from '../fields';

type Schema = Record<string, unknown>;

const SCOPES: { value: Condition['scope']; label: string }[] = [
  { value: 'value', label: 'the run' },
  { value: 'anyJob', label: 'any job' },
  { value: 'everyJob', label: 'every job' },
];

const OPERATORS: { value: Condition['operator']; label: string }[] = [
  { value: 'is', label: 'is' },
  { value: 'oneOf', label: 'is one of' },
  { value: 'startsWith', label: 'starts with' },
  { value: 'endsWith', label: 'ends with' },
  { value: 'contains', label: 'contains' },
  { value: 'regex', label: 'matches regex' },
];

const isObject = (v: unknown): v is Schema =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function JsonTest({
  label,
  test,
  onChange,
}: {
  label: string;
  test: Schema;
  onChange: (test: Schema) => void;
}): React.JSX.Element {
  const text = JSON.stringify(test, null, 2);
  const [draft, setDraft] = useState(text);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-1">
      <textarea
        aria-label={`${label} JSON`}
        className="min-h-24 rounded border bg-background p-2 font-mono text-xs"
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
        }}
        onBlur={() => {
          try {
            const parsed: unknown = JSON.parse(draft);
            if (!isObject(parsed)) throw new Error('expected an object');
            setError(null);
            onChange(parsed);
          } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
          }
        }}
      />
      {error && (
        <p role="alert" className="text-xs text-status-failure">
          Not saved: {error}
        </p>
      )}
    </div>
  );
}

function ConditionsForm({
  label,
  conditions,
  onChange,
  jobsScope,
}: {
  label: string;
  conditions: Condition[];
  onChange: (conditions: Condition[]) => void;
  jobsScope: boolean;
}): React.JSX.Element {
  const set = (i: number, change: Partial<Condition>) => {
    onChange(conditions.map((c, j) => (j === i ? { ...c, ...change } : c)));
  };
  return (
    <div className="flex flex-col gap-1" role="group" aria-label={label}>
      {conditions.length === 0 && (
        <p className="text-xs text-muted-foreground">Matches everything.</p>
      )}
      {conditions.map((c, i) => {
        const n = `${label} condition ${String(i + 1)}`;
        return (
          <div key={i} className="flex flex-wrap items-center gap-1">
            {jobsScope && (
              <Choice
                label={`${n} scope`}
                value={c.scope}
                options={SCOPES}
                onValueChange={(scope) => {
                  set(i, { scope });
                }}
              />
            )}
            <CommitInput
              label={`${n} field`}
              className="h-9 w-28"
              value={c.field}
              onCommit={(field) => {
                set(i, { field });
              }}
            />
            <Choice
              label={`${n} operator`}
              value={c.operator}
              options={OPERATORS}
              onValueChange={(operator) => {
                set(i, { operator });
              }}
            />
            <CommitInput
              label={`${n} value`}
              className="h-9 w-36"
              optional
              value={c.value}
              onCommit={(value) => {
                set(i, { value });
              }}
            />
            <Button
              size="sm"
              variant="ghost"
              aria-label={`Delete ${n}`}
              onClick={() => {
                onChange(conditions.filter((_, j) => j !== i));
              }}
            >
              ×
            </Button>
          </div>
        );
      })}
      <Button
        size="sm"
        variant="outline"
        className="self-start"
        onClick={() => {
          onChange([
            ...conditions,
            {
              scope: jobsScope ? 'anyJob' : 'value',
              field: jobsScope ? 'conclusion' : 'status',
              operator: 'is',
              value: '',
            },
          ]);
        }}
      >
        Add condition
      </Button>
    </div>
  );
}

/** Edit `test`. `jobsScope`: the documents have jobs (GitHub runs), so
 * conditions may test any or every job. */
export function TestEditor({
  label,
  test,
  onChange,
  jobsScope,
}: {
  label: string;
  test: Schema;
  onChange: (test: Schema) => void;
  jobsScope: boolean;
}): React.JSX.Element {
  const conditions = fromSchema(test);
  const [json, setJson] = useState(conditions === undefined);
  const form = json ? undefined : conditions;
  return (
    <div className="flex flex-col gap-1">
      {!form ? (
        <JsonTest
          key={JSON.stringify(test)}
          label={label}
          test={test}
          onChange={onChange}
        />
      ) : (
        <ConditionsForm
          label={label}
          conditions={form}
          jobsScope={jobsScope}
          onChange={(next) => {
            onChange(toSchema(next));
          }}
        />
      )}
      {conditions !== undefined && (
        <Button
          size="sm"
          variant="link"
          className="self-start px-0"
          onClick={() => {
            setJson(!json);
          }}
        >
          {form ? 'Edit as JSON' : 'Edit as conditions'}
        </Button>
      )}
    </div>
  );
}
