/**
 * A rule (spec.md A§4.3.7): rows of checks (path, operator, value, any or
 * every value, ignore case, NOT) joined by AND or OR. A check that can't
 * run (a bad path or regex) says why under its row. With real data for
 * the rule (the board's records for its source, or raw samples for a
 * source rule's translation and branch rules), each check and the rule
 * show how many they match, the path field suggests their paths, and the
 * field picker shows one as a tree. *Only items where* is offered when
 * the source has items; a check drafted from a record (*Add rule*) is
 * offered to add.
 *
 * @module
 */
import type { JSONValue } from 'json-p3';
import { useContext } from 'react';

import { Choice } from '@/components/Choice';
import { Button } from '@/components/ui/button';
import type { Provider } from '@/domain/config/providers';
import type { RecordDoc } from '@/domain/model/translate';
import { isAlways } from '@/domain/rules/always';
import {
  checkProblem,
  evaluateCheck,
  evaluateRule,
} from '@/domain/rules/check';
import { PATH_IDENTIFIER } from '@/domain/rules/path';
import { type Check, CheckSchema, type Rule } from '@/domain/rules/schema';
import { patchAt } from '@/lib/lists';

import { useDraftCheck } from '../editTarget';
import { CheckRow } from './CheckRow';
import { ItemsWhereBuilder } from './ItemsWhereBuilder';
import {
  samplePaths,
  SourcesWithItemsContext,
  useRuleSamples,
} from './samples';

const COMBINES: { value: Rule['combine']; label: string }[] = [
  { value: 'and', label: 'all checks (AND)' },
  { value: 'or', label: 'any check (OR)' },
];

/** Item keys the board's records have (`name` and `state` without any). */
const itemKeys = (records: readonly RecordDoc[]): string[] => {
  const keys = samplePaths(records, 'item').map((p) => p.replace(/^\$\./, ''));
  return keys.length > 0
    ? keys.filter((k) => PATH_IDENTIFIER.test(k))
    : ['name', 'state'];
};

const describe = (c: Check) =>
  `${c.not ? 'NOT ' : ''}${c.path} ${c.operator === 'exists' ? 'exists' : `matches ${c.value}`}`;

export function RuleEditor({
  label,
  rule,
  onChange,
  newPath = '$.',
  provider,
  scope = 'record',
  target,
  documents,
  noun: nounOverride,
}: {
  label: string;
  rule: Rule;
  onChange: (rule: Rule) => void;
  /** The path a new check starts with. */
  newPath?: string;
  /** The source whose board records the preview and picker use. */
  provider?: Provider;
  /** What `$` is: a record, or one of its items. */
  scope?: 'record' | 'item';
  /** This rule's editor-item key (to be opened on, with a drafted check). */
  target?: string;
  /** Real data to preview over instead of the board's records (raw
   * samples for a source rule). */
  documents?: readonly JSONValue[];
  /** What `documents` are, e.g. "runs". */
  noun?: string;
}): React.JSX.Element {
  const checks = rule.checks;
  const records = useRuleSamples(provider);
  const withItems = useContext(SourcesWithItemsContext);
  const drafted = useDraftCheck(target);
  const docs: readonly JSONValue[] =
    documents ??
    (scope === 'item'
      ? records.flatMap((r) => (Array.isArray(r.items) ? r.items : []))
      : records);
  const noun = nounOverride ?? (scope === 'item' ? 'items' : 'records');
  const count = (test: (d: JSONValue) => boolean) =>
    docs.length === 0
      ? undefined
      : `${String(docs.filter(test).length)} of ${String(docs.length)} ${noun}`;
  const paths = documents
    ? samplePaths(docs.filter(isRecordDoc), 'record')
    : samplePaths(records, scope);
  const listId = paths.length > 0 ? `${label}-paths` : undefined;
  const ruleOk = rule.checks.every((c) => !checkProblem(c));
  const add = (c: Check) => {
    onChange({ ...rule, checks: [...checks, c] });
  };
  const offered =
    drafted &&
    !checks.some((c) => JSON.stringify(c) === JSON.stringify(drafted))
      ? drafted
      : undefined;
  return (
    <div
      className="flex flex-col gap-1"
      role="group"
      aria-label={label}
      data-edit-target={target}
    >
      {isAlways(rule) ? (
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
          listId={listId}
          pickFrom={docs[0]}
          matched={count((d) => evaluateCheck(c, d))}
          onChange={(change) => {
            onChange({ ...rule, checks: patchAt(checks, i, change) });
          }}
          onRemove={() => {
            onChange({ ...rule, checks: checks.filter((_, j) => j !== i) });
          }}
        />
      ))}
      {listId && (
        <datalist id={listId}>
          {paths.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
      )}
      {checks.length > 0 && ruleOk && docs.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Rule matches {count((d) => evaluateRule(rule, d))}
        </p>
      )}
      {offered && (
        <div className="flex flex-wrap items-center gap-2 rounded border border-dashed px-2 py-1 text-xs">
          <span>
            Drafted from the record:{' '}
            <code className="font-mono">{describe(offered)}</code>
            {count((d) => evaluateCheck(offered, d)) &&
              ` (${count((d) => evaluateCheck(offered, d)) ?? ''})`}
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              add(offered);
            }}
          >
            Add drafted check
          </Button>
        </div>
      )}
      {scope === 'record' &&
        documents === undefined &&
        provider !== undefined &&
        withItems.includes(provider) && (
          <ItemsWhereBuilder
            label={label}
            itemKeys={itemKeys(records)}
            onAdd={add}
          />
        )}
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="self-start"
        onClick={() => {
          add(CheckSchema.parse({ path: newPath }));
        }}
      >
        Add check
      </Button>
    </div>
  );
}

function isRecordDoc(v: JSONValue): v is RecordDoc {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
