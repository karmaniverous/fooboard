/**
 * One check of a rule (spec.md A§4.3.7): path (typed, or picked from a
 * real record), operator, value, any or every value, ignore case, NOT;
 * how many records it matches, and why it can't run when it can't.
 *
 * @module
 */
import type { JSONValue } from 'json-p3';

import { Choice } from '@/components/Choice';
import { Button } from '@/components/ui/button';
import { checkProblem } from '@/domain/rules/check';
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
  pickFrom,
}: {
  label: string;
  check: Check;
  listId: string | undefined;
  /** "n of m" when there are records to test. */
  matched: string | undefined;
  onChange: (change: Partial<Check>) => void;
  onRemove: () => void;
  /** A real record to pick the path from. */
  pickFrom?: JSONValue;
}): React.JSX.Element {
  const problem = checkProblem(check);
  const flag = (name: 'ignoreCase' | 'not', text: string) => (
    <label className="flex items-center gap-1 text-xs">
      <input
        type="checkbox"
        checked={check[name]}
        onChange={(e) => {
          onChange({ [name]: e.target.checked });
        }}
      />
      {text}
    </label>
  );
  return (
    <div className="flex flex-col gap-0.5" role="group" aria-label={label}>
      <div className="flex flex-wrap items-center gap-1">
        <CommitInput
          label={`${label} path`}
          className="h-9 w-56 font-mono"
          list={listId}
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
