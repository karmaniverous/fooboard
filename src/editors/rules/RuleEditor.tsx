/**
 * A rule (spec.md A§4.3.7): rows of checks (path, operator, value, any or
 * every value, ignore case, NOT) joined by AND or OR. A check that can't
 * run (a bad path or regex) says why under its row.
 *
 * @module
 */
import { Choice } from '@/components/Choice';
import { Button } from '@/components/ui/button';
import { checkProblem } from '@/domain/rules/check';
import { type Check, CheckSchema, type Rule } from '@/domain/rules/schema';
import { patchAt } from '@/lib/lists';

import { CommitInput } from '../fields';

const OPERATORS: { value: Check['operator']; label: string }[] = [
  { value: 'glob', label: 'matches glob' },
  { value: 'regex', label: 'matches regex' },
  { value: 'exists', label: 'exists' },
];
const QUANTIFIERS: { value: Check['quantifier']; label: string }[] = [
  { value: 'any', label: 'any value' },
  { value: 'every', label: 'every value' },
];
const COMBINES: { value: Rule['combine']; label: string }[] = [
  { value: 'and', label: 'all checks (AND)' },
  { value: 'or', label: 'any check (OR)' },
];

function CheckRow({
  label,
  check,
  onChange,
  onRemove,
}: {
  label: string;
  check: Check;
  onChange: (change: Partial<Check>) => void;
  onRemove: () => void;
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
      </div>
      {problem && (
        <p role="alert" className="text-xs text-status-failure">
          {problem}
        </p>
      )}
    </div>
  );
}

export function RuleEditor({
  label,
  rule,
  onChange,
  newPath = '$.',
}: {
  label: string;
  rule: Rule;
  onChange: (rule: Rule) => void;
  /** The path a new check starts with. */
  newPath?: string;
}): React.JSX.Element {
  const checks = rule.checks;
  return (
    <div className="flex flex-col gap-1" role="group" aria-label={label}>
      {checks.length === 0 ? (
        <p className="text-xs text-muted-foreground">Matches everything.</p>
      ) : (
        checks.length > 1 && (
          <Choice
            label={`${label} joins`}
            value={rule.combine}
            options={COMBINES}
            onValueChange={(combine) => {
              onChange({ ...rule, combine });
            }}
          />
        )
      )}
      {checks.map((c, i) => (
        <CheckRow
          key={i}
          label={`${label} check ${String(i + 1)}`}
          check={c}
          onChange={(change) => {
            onChange({ ...rule, checks: patchAt(checks, i, change) });
          }}
          onRemove={() => {
            onChange({ ...rule, checks: checks.filter((_, j) => j !== i) });
          }}
        />
      ))}
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="self-start"
        onClick={() => {
          onChange({
            ...rule,
            checks: [...checks, CheckSchema.parse({ path: newPath })],
          });
        }}
      >
        Add check
      </Button>
    </div>
  );
}
