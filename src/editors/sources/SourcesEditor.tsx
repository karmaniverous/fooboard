/**
 * The Sources tab (spec.md A§4.3.7): the source rule each source uses,
 * from the built-ins and the dashboard's own. *Customise* copies the
 * chosen rule into one the dashboard owns, to edit: which records to keep
 * and what the reader asks for (keys and items are edited from the
 * record's raw data).
 *
 * @module
 */
import { Choice } from '@/components/Choice';
import { Button } from '@/components/ui/button';
import type { Dashboard } from '@/domain/config/dashboard';
import { PROVIDER_LABELS, STATUS_PROVIDERS } from '@/domain/config/statusSets';
import { BUILTIN_SOURCES } from '@/domain/model/builtinSources';
import type { SourceRule } from '@/domain/model/sourceRule';

import { CommitInput } from '../fields';
import { RuleEditor } from '../rules/RuleEditor';
import {
  chooseSource,
  customiseSource,
  removeSource,
  sourceInUse,
  updateSource,
} from './customSource';

const optionsFor = (dashboard: Dashboard, provider: SourceRule['provider']) =>
  [...BUILTIN_SOURCES, ...dashboard.customSourceRules]
    .filter((s) => s.provider === provider)
    .map((s) => ({ value: s.id, label: s.name }));

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

function CustomSourceEditor({
  rule,
  onChange,
  onRemove,
}: {
  rule: SourceRule;
  onChange: (rule: SourceRule) => void;
  onRemove: (() => void) | undefined;
}): React.JSX.Element {
  return (
    <section
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
      <h4 className="text-xs font-semibold">Records to keep</h4>
      <RuleEditor
        label={`${rule.name} keep rule`}
        rule={rule.keep}
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
              min={1}
              max={500}
              onCommit={(runs) => {
                onChange({ ...rule, reader: { ...rule.reader, runs } });
              }}
            />
          </span>
          <span className="text-muted-foreground">
            {rule.reader.runs > 100
              ? `${String(Math.ceil(rule.reader.runs / 100))} requests per repo per poll`
              : '1 request per repo per poll'}
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-1 text-xs">
          <span className="flex items-center gap-1">
            Jobs per branch
            <NumberField
              label="Jobs per branch"
              value={rule.reader.jobsPerBranch}
              min={1}
              max={100}
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
            onChange={(branches) => {
              onChange({ ...rule, reader: { ...rule.reader, branches } });
            }}
          />
        </div>
      )}
    </section>
  );
}

export function SourcesEditor({
  dashboard,
  onChange,
}: {
  dashboard: Dashboard;
  onChange: (dashboard: Dashboard) => void;
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-3 text-sm">
      <p className="text-xs text-muted-foreground">
        A source rule turns a source&apos;s data into records the other rules
        test.
      </p>
      {STATUS_PROVIDERS.map((provider) => {
        const label = PROVIDER_LABELS[provider];
        return (
          <label key={provider} className="flex items-center gap-2">
            <span className="w-20">{label}</span>
            <Choice
              label={`${label} source rule`}
              value={dashboard.sourceRules[provider]}
              options={optionsFor(dashboard, provider)}
              onValueChange={(id) => {
                onChange(chooseSource(dashboard, provider, id));
              }}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                onChange(
                  customiseSource(dashboard, dashboard.sourceRules[provider]),
                );
              }}
            >
              Customise
            </Button>
          </label>
        );
      })}
      {dashboard.customSourceRules.map((rule) => (
        <CustomSourceEditor
          key={rule.id}
          rule={rule}
          onChange={(next) => {
            onChange(updateSource(dashboard, next));
          }}
          onRemove={
            sourceInUse(dashboard, rule.id)
              ? undefined
              : () => {
                  onChange(removeSource(dashboard, rule.id));
                }
          }
        />
      ))}
    </div>
  );
}
