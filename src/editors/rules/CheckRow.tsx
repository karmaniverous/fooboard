/**
 * One check of a rule (spec.md A§4.3.7): path (typed, or picked from a
 * real record), operator, value, any or every value, ignore case, NOT;
 * how many records it matches, why it can't run when it can't, and, when
 * a glob or regex path finds an object or array, to test a field inside
 * it (the path field's description).
 *
 * @module
 */
import type { JSONValue } from 'json-p3';
import { useId } from 'react';

import { CheckField } from '@/components/CheckField';
import { Choice } from '@/components/Choice';
import { Button } from '@/components/ui/button';
import { checkProblem, OBJECT_OR_ARRAY_HINT } from '@/domain/rules/check';
import type { Check } from '@/domain/rules/schema';

import { CommitInput } from '../fields';
import { FieldPicker } from './FieldPicker';

const OPERATORS: { value: Check['operator']; label: string }[] = [
  { value: 'glob', label: 'matches glob' },
  { value: 'regex', label: 'matches regex' },
  { value: 'exists', label: 'exists' },
];
const QUANTIFIERS: { value: Check['quantifier']; label: string }[] = [
  { value: 'any', label: 'any value' },
  { value: 'every', label: 'every value' },
];

export function CheckRow({
  label,
  check,
  onChange,
  onRemove,
  listId,
  matched,
  findsObjectOrArray,
  pickFrom,
}: {
  label: string;
  check: Check;
  listId: string | undefined;
  /** "n of m" when there are records to test. */
  matched: string | undefined;
  /** Whether the path finds an object or array for glob or regex to test
   * (`findsObjectOrArray` over the previewed records). */
  findsObjectOrArray: boolean;
  onChange: (change: Partial<Check>) => void;
  onRemove: () => void;
  /** A real record to pick the path from. */
  pickFrom?: JSONValue;
}): React.JSX.Element {
  const problem = checkProblem(check);
  const hintId = useId();
  const flag = (name: 'ignoreCase' | 'not', text: string) => (
    <CheckField
      label={text}
      checked={check[name]}
      onCheckedChange={(on) => {
        onChange({ [name]: on });
      }}
    />
  );
  return (
    <div className="flex flex-col gap-0.5" role="group" aria-label={label}>
      <div className="flex flex-wrap items-center gap-1">
        <CommitInput
          label={`${label} path`}
          className="h-9 w-56 font-mono"
          list={listId}
          describedBy={findsObjectOrArray ? hintId : undefined}
          value={check.path}
          onCommit={(path) => {
            onChange({ path });
          }}
        />
        <Choice
          label={`${label} operator`}
          value={check.operator}
          options={OPERATORS}
          onValueChange={(operator) => {
            onChange({ operator });
          }}
        />
        {check.operator !== 'exists' && (
          <CommitInput
            label={`${label} value`}
            className="h-9 w-40 font-mono"
            optional
            value={check.value}
            onCommit={(value) => {
              onChange({ value });
            }}
          />
        )}
        <Choice
          label={`${label} values`}
          value={check.quantifier}
          options={QUANTIFIERS}
          onValueChange={(quantifier) => {
            onChange({ quantifier });
          }}
        />
        {check.operator !== 'exists' && flag('ignoreCase', 'Ignore case')}
        {flag('not', 'NOT')}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          aria-label={`Delete ${label}`}
          onClick={onRemove}
        >
          ×
        </Button>
        {matched && !problem && (
          <span className="text-xs text-muted-foreground">{matched}</span>
        )}
      </div>
      {findsObjectOrArray && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {OBJECT_OR_ARRAY_HINT}
        </p>
      )}
      {pickFrom !== undefined && (
        <FieldPicker
          label={label}
          doc={pickFrom}
          onPick={(path) => {
            onChange({ path });
          }}
        />
      )}
      {problem && (
        <p role="alert" className="text-xs text-status-failure">
          {problem}
        </p>
      )}
    </div>
  );
}
