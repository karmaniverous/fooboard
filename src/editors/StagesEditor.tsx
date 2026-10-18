/**
 * Stages (spec.md C-21): new stages start from the branches actually in
 * the dashboard's repos, listed with how many repos have each; pick one,
 * or type a pattern and see what it matches before adding. Stages can be
 * renamed, re-patterned, reordered and removed, and given a source stage
 * (choices that would make a cycle are not offered), and put into, out of
 * or between column groups.
 *
 * @module
 */
import { useState } from 'react';

import { Choice } from '@/components/Choice';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { wouldCreateCycle } from '@/domain/config/cycle';
import type { Dashboard } from '@/domain/config/dashboard';
import type { Stage } from '@/domain/config/stage';
import type { EngineProviders } from '@/engine';

import { discoverBranches, patternPreview } from './branches';
import { BranchFinder } from './BranchFinder';
import { removeStage, uniqueId } from './edit';
import { CommitInput } from './fields';
import { GroupControl } from './GroupControl';
import { listHandlers } from './groupEdit';
import { ReorderList } from './ReorderList';
import { useLoad } from './useLoad';

function AddStage({
  dashboard,
  providers,
  onAdd,
  initialPattern = '',
}: {
  dashboard: Dashboard;
  providers: EngineProviders;
  onAdd: (stage: Stage) => void;
  initialPattern?: string;
}): React.JSX.Element {
  const [found, load] = useLoad<Map<string, string[]>>();
  const [pattern, setPattern] = useState(initialPattern);
  const [name, setName] = useState('');
  const byRepo = found.kind === 'done' ? found.value : undefined;
  const preview = byRepo ? patternPreview(pattern, byRepo) : undefined;
  const add = () => {
    const p = pattern.trim();
    const n = name.trim() || p;
    onAdd({
      id: uniqueId(
        n,
        dashboard.stages.map((s) => s.id),
      ),
      name: n,
      branchPattern: p,
    });
    setPattern('');
    setName('');
  };
  return (
    <section className="flex flex-col gap-2 rounded-md border p-2 text-xs">
      <h3 className="text-sm font-semibold">Add a stage</h3>
      <BranchFinder
        found={found}
        label="Find branches in your repos"
        disabled={dashboard.rows.length === 0}
        onFind={() => {
          load(() => discoverBranches(dashboard, providers));
        }}
        onPick={setPattern}
      />
      <form
        className="flex flex-wrap items-center gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          if (pattern.trim()) add();
        }}
      >
        <Input
          aria-label="New stage branch or pattern"
          placeholder="Branch or pattern, e.g. release/**"
          className="h-8 text-xs"
          value={pattern}
          onChange={(e) => {
            setPattern(e.target.value);
          }}
        />
        <Input
          aria-label="New stage name"
          placeholder="Name (defaults to the pattern)"
          className="h-8 text-xs"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
          }}
        />
        <Button
          type="submit"
          size="sm"
          variant="outline"
          disabled={!pattern.trim()}
        >
          Add stage
        </Button>
      </form>
      {preview && pattern.trim() && (
        <p aria-live="polite" className="text-muted-foreground">
          Matches {preview.repos.length}/{byRepo?.size ?? 0} repos
          {preview.branches.length > 0 &&
            `: ${preview.branches.slice(0, 8).join(', ')}${preview.branches.length > 8 ? '…' : ''}`}
        </p>
      )}
    </section>
  );
}

export function StagesEditor({
  dashboard,
  providers,
  onChange,
  draftPattern,
}: {
  dashboard: Dashboard;
  providers: EngineProviders;
  onChange: (dashboard: Dashboard) => void;
  /** Pre-fills a new stage (e.g. *Add test* for an unmatched branch). */
  draftPattern?: string;
}): React.JSX.Element {
  const { stages } = dashboard;
  const replace = (stage: Stage) => {
    onChange({
      ...dashboard,
      stages: stages.map((s) => (s.id === stage.id ? stage : s)),
    });
  };
  return (
    <div className="flex flex-col gap-3 text-sm">
      <ReorderList
        items={stages}
        keyOf={(s) => s.id}
        nameOf={(s) => s.name}
        {...listHandlers(dashboard, 'stages', onChange)}
        onRemove={(s) => {
          onChange(removeStage(dashboard, s.id));
        }}
      >
        {(stage) => (
          <div className="flex flex-col gap-1 text-xs">
            <div className="flex items-center gap-1">
              <CommitInput
                label={`Name of ${stage.name}`}
                className="h-8 text-xs"
                value={stage.name}
                onCommit={(name) => {
                  replace({ ...stage, name });
                }}
              />
              <CommitInput
                label={`Branch pattern of ${stage.name}`}
                className="h-8 font-mono text-xs"
                value={stage.branchPattern}
                onCommit={(branchPattern) => {
                  replace({ ...stage, branchPattern });
                }}
              />
            </div>
            <Choice
              label={`Source stage of ${stage.name}`}
              className="h-8"
              value={stage.sourceStageId ?? ''}
              options={[
                { value: '', label: 'No source stage' },
                ...stages
                  .filter((s) => !wouldCreateCycle(stages, stage.id, s.id))
                  .map((s) => ({ value: s.id, label: `Source: ${s.name}` })),
              ]}
              onValueChange={(v) => {
                replace({ ...stage, sourceStageId: v || undefined });
              }}
            />
            <GroupControl
              dashboard={dashboard}
              axis="stages"
              itemId={stage.id}
              name={stage.name}
              onChange={onChange}
            />
          </div>
        )}
      </ReorderList>
      <AddStage
        dashboard={dashboard}
        providers={providers}
        initialPattern={draftPattern}
        onAdd={(stage) => {
          onChange({ ...dashboard, stages: [...stages, stage] });
        }}
      />
    </div>
  );
}
