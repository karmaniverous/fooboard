/**
 * A source rule the dashboard owns (spec.md A§4.3.7): its name, record
 * and item keys (translation rules previewed over the raw data of the
 * board's records), the order key, which records to keep, and what the
 * reader asks for (GitHub runs; Amplify jobs per branch and the branch
 * rule, previewed over the branch lists read).
 *
 * @module
 */
import { useContext } from 'react';

import { Choice } from '@/components/Choice';
import { Button } from '@/components/ui/button';
import type { Provider } from '@/domain/config/providers';
import {
  MAX_AMPLIFY_JOBS_PER_BRANCH,
  MAX_GITHUB_RUNS,
  MIN_READ,
  type SourceRule,
} from '@/domain/model/sourceRule';
import { pagesFor } from '@/lib/github';

import { CommitInput } from '../fields';
import { RuleEditor } from '../rules/RuleEditor';
import {
  BranchSamplesContext,
  rawSamples,
  useRuleSamples,
} from '../rules/samples';
import { KeysEditor } from './KeysEditor';

/** What each source's raw data is, for the translation previews. */
const RAW_NOUNS = {
  github: 'raw runs',
  amplify: 'raw jobs',
} as const satisfies Record<Provider, string>;

/** The GitHub requests a read of `runs` makes, in words. */
const requestsText = (runs: number): string => {
  const pages = pagesFor(runs);
  return pages === 1
    ? '1 request per repo per poll'
    : `${String(pages)} requests per repo per poll`;
};

/** A number setting committed on blur, clamped to `[min, max]`. */
function NumberField({
  label,
  value,
  min,
  max,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onCommit: (value: number) => void;
}): React.JSX.Element {
  return (
    <CommitInput
      label={label}
      className="h-9 w-20"
      value={String(value)}
      onCommit={(text) => {
        const n = Math.round(Number(text));
        if (Number.isFinite(n)) onCommit(Math.min(max, Math.max(min, n)));
      }}
    />
  );
}

export function CustomSourceEditor({
  rule,
  onChange,
  onRemove,
  chosen,
}: {
  rule: SourceRule;
  /** Is it the rule its source uses (the one the editor opens on)? */
  chosen: boolean;
  onChange: (rule: SourceRule) => void;
  onRemove: (() => void) | undefined;
}): React.JSX.Element {
  const records = useRuleSamples(rule.provider);
  const raw = rawSamples(records, rule.items?.path);
  const branches = useContext(BranchSamplesContext);
  const target = chosen ? `source:${rule.provider}` : undefined;
  return (
    <section
      data-edit-target={target}
      aria-label={`Source rule ${rule.name}`}
      className="flex flex-col gap-2 rounded-md border p-3"
    >
      <div className="flex items-center gap-2">
        <CommitInput
          label="Source rule name"
          className="h-9 w-64"
          value={rule.name}
          onCommit={(name) => {
            onChange({ ...rule, name });
          }}
        />
        <Button
          size="sm"
          variant="outline"
          disabled={!onRemove}
          onClick={onRemove}
        >
          Remove
        </Button>
      </div>
      <h4 className="text-xs font-semibold">Records</h4>
      <KeysEditor
        title="Record keys"
        keys={rule.keys}
        samples={raw.records}
        noun={RAW_NOUNS[rule.provider]}
        target={target}
        onChange={(keys) => {
          onChange({ ...rule, keys });
        }}
      />
      {rule.items && (
        <>
          <label className="flex items-center gap-2 text-xs">
            Items from
            <CommitInput
              label="Items path"
              className="h-9 w-56 font-mono"
              value={rule.items.path}
              onCommit={(path) => {
                if (path && rule.items)
                  onChange({ ...rule, items: { ...rule.items, path } });
              }}
            />
          </label>
          <KeysEditor
            title="Item keys"
            keys={rule.items.keys}
            samples={raw.items}
            noun="raw items"
            target={target}
            onChange={(keys) => {
              if (rule.items)
                onChange({ ...rule, items: { ...rule.items, keys } });
            }}
          />
        </>
      )}
      <label className="flex items-center gap-2 text-xs">
        Newest by
        <Choice
          label="Order key"
          value={rule.order}
          options={rule.keys.map((k) => ({ value: k.name, label: k.name }))}
          onValueChange={(order) => {
            onChange({ ...rule, order });
          }}
        />
      </label>
      <h4 className="text-xs font-semibold">Records to keep</h4>
      <RuleEditor
        label={`${rule.name} keep rule`}
        rule={rule.keep}
        provider={rule.provider}
        onChange={(keep) => {
          onChange({ ...rule, keep });
        }}
      />
      <h4 className="text-xs font-semibold">What to read</h4>
      {rule.provider === 'github' ? (
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={rule.reader.excludePullRequests}
              onChange={(e) => {
                onChange({
                  ...rule,
                  reader: {
                    ...rule.reader,
                    excludePullRequests: e.target.checked,
                  },
                });
              }}
            />
            Skip pull-request runs
          </label>
          <span className="flex items-center gap-1">
            Runs per repo
            <NumberField
              label="Runs per repo"
              value={rule.reader.runs}
              min={MIN_READ}
              max={MAX_GITHUB_RUNS}
              onCommit={(runs) => {
                onChange({ ...rule, reader: { ...rule.reader, runs } });
              }}
            />
          </span>
          <span className="text-muted-foreground">
            {requestsText(rule.reader.runs)}
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-1 text-xs">
          <span className="flex items-center gap-1">
            Jobs per branch
            <NumberField
              label="Jobs per branch"
              value={rule.reader.jobsPerBranch}
              min={MIN_READ}
              max={MAX_AMPLIFY_JOBS_PER_BRANCH}
              onCommit={(jobsPerBranch) => {
                onChange({
                  ...rule,
                  reader: { ...rule.reader, jobsPerBranch },
                });
              }}
            />
          </span>
          <span>Branches to read (every branch when empty)</span>
          <RuleEditor
            label={`${rule.name} branch rule`}
            rule={rule.reader.branches}
            newPath="$.branchName"
            documents={branches}
            noun="branches"
            onChange={(branches) => {
              onChange({ ...rule, reader: { ...rule.reader, branches } });
            }}
          />
        </div>
      )}
    </section>
  );
}
