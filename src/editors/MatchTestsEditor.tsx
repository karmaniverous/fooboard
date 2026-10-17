/**
 * A list of match tests (spec.md §4.3): field, operator and value. Used
 * for row key tests, phase tests and the workflow filter.
 *
 * @module
 */
import { useState } from 'react';

import { ConfirmButton } from '@/components/ConfirmButton';
import { NativeSelect } from '@/components/NativeSelect';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type {
  MatchField,
  MatchOperator,
  MatchTest,
} from '@/domain/config/matchTest';

import { CommitInput } from './fields';

const OPERATORS: MatchOperator[] = [
  'is',
  'startsWith',
  'endsWith',
  'contains',
  'regex',
];
const FIELD_LABEL: Record<MatchField, string> = {
  jobName: 'job name',
  workflowName: 'workflow name',
};

type TestOn<F extends MatchField> = MatchTest & { field: F };

export function MatchTestsEditor<F extends MatchField>({
  title,
  fields,
  tests,
  onChange,
  draft,
}: {
  title: string;
  /** Fields a test may look at; the first is the default. */
  fields: readonly [F, ...F[]];
  tests: readonly TestOn<F>[];
  onChange: (tests: TestOn<F>[]) => void;
  /** Pre-fills the new-test form (e.g. *Add test* from an unmapped run). */
  draft?: MatchTest;
}): React.JSX.Element {
  const draftField = fields.find((f) => f === draft?.field);
  const [value, setValue] = useState(draft?.value ?? '');
  const [field, setField] = useState<F>(draftField ?? fields[0]);
  const [operator, setOperator] = useState<MatchOperator>(
    draft?.operator ?? 'contains',
  );
  const replace = (i: number, test: TestOn<F>) => {
    onChange(tests.map((t, j) => (j === i ? test : t)));
  };
  const fieldSelect = (current: F, onPick: (f: F) => void, label: string) =>
    fields.length > 1 ? (
      <NativeSelect
        aria-label={label}
        className="h-8 px-1"
        value={current}
        onChange={(e) => {
          onPick(e.target.value as F);
        }}
      >
        {fields.map((f) => (
          <option key={f} value={f}>
            {FIELD_LABEL[f]}
          </option>
        ))}
      </NativeSelect>
    ) : (
      <span className="text-muted-foreground">{FIELD_LABEL[current]}</span>
    );
  const operatorSelect = (
    current: MatchOperator,
    onPick: (o: MatchOperator) => void,
    label: string,
  ) => (
    <NativeSelect
      aria-label={label}
      className="h-8 px-1"
      value={current}
      onChange={(e) => {
        onPick(e.target.value as MatchOperator);
      }}
    >
      {OPERATORS.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </NativeSelect>
  );

  return (
    <fieldset className="flex flex-col gap-1 text-xs">
      <legend className="font-semibold">{title}</legend>
      {tests.length === 0 && <p className="text-muted-foreground">None.</p>}
      {tests.map((t, i) => (
        <div
          key={`${String(i)}-${t.field}`}
          className="flex items-center gap-1"
        >
          {fieldSelect(
            t.field,
            (f) => {
              replace(i, { ...t, field: f });
            },
            `${title} ${String(i + 1)} field`,
          )}
          {operatorSelect(
            t.operator,
            (o) => {
              replace(i, { ...t, operator: o });
            },
            `${title} ${String(i + 1)} operator`,
          )}
          <CommitInput
            label={`${title} ${String(i + 1)} value`}
            className="h-8 text-xs"
            value={t.value}
            onCommit={(v) => {
              replace(i, { ...t, value: v });
            }}
          />
          <ConfirmButton
            label={`Delete ${title} ${String(i + 1)}`}
            confirmLabel={`Delete ${t.value}`}
            onConfirm={() => {
              onChange(tests.filter((_, j) => j !== i));
            }}
          >
            Delete
          </ConfirmButton>
        </div>
      ))}
      <form
        className="flex items-center gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          if (!value.trim()) return;
          onChange([...tests, { field, operator, value: value.trim() }]);
          setValue('');
        }}
      >
        {fieldSelect(field, setField, `New ${title} field`)}
        {operatorSelect(operator, setOperator, `New ${title} operator`)}
        <Input
          aria-label={`New ${title} value`}
          className="h-8 text-xs"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
          }}
        />
        <Button
          type="submit"
          size="sm"
          variant="outline"
          disabled={!value.trim()}
        >
          Add
        </Button>
      </form>
    </fieldset>
  );
}
