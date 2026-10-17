/**
 * Stages (spec.md C-21): new stages start from the branches actually in
 * the dashboard's repos, listed with how many repos have each; pick one,
 * or type a pattern and see what it matches before adding. Stages can be
 * renamed, re-patterned, reordered and removed, and given a source stage
 * (choices that would make a cycle are not offered), plus the divider
 * before each column.
 *
 * @module
 */
import { useState } from 'react';

import { NativeSelect } from '@/components/NativeSelect';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { resolveCredentialId } from '@/domain/config/credentialRefs';
import { wouldCreateCycle } from '@/domain/config/cycle';
import type { Dashboard } from '@/domain/config/dashboard';
import type { Stage } from '@/domain/config/stage';
import type { EngineProviders } from '@/engine';

import {
  branchCounts,
  patternPreview,
  removeStage,
  setDivider,
  uniqueId,
} from './edit';
import { CommitInput, DividerControl } from './fields';
import { LoadStatus } from './LoadStatus';
import { ReorderList } from './ReorderList';
import { useLoad } from './useLoad';

/** Branch names per repo, read with each row's own GitHub token. */
async function discoverBranches(
  dashboard: Dashboard,
  providers: EngineProviders,
): Promise<Map<string, string[]>> {
  const byRepo = new Map<string, string[]>();
  for (const row of dashboard.rows) {
    if (byRepo.has(row.repo)) continue;
    const override =
      row.type === 'github' ? row.credentialId : row.githubCredentialId;
    const id = resolveCredentialId(
      dashboard.defaultCredentials,
      'github',
      override,
    );
    const reader = id ? providers.github(id) : undefined;
    if (!reader) continue;
    const [owner = '', repo = ''] = row.repo.split('/');
    const branches = await reader.listBranches({ owner, repo });
    byRepo.set(
      row.repo,
      branches.map((b) => b.name),
    );
  }
  return byRepo;
}

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
      {found.kind !== 'done' && (
        <Button
          size="sm"
          variant="outline"
          className="self-start"
          disabled={found.kind === 'loading' || dashboard.rows.length === 0}
          onClick={() => {
            load(() => discoverBranches(dashboard, providers));
          }}
        >
          {found.kind === 'loading'
            ? 'Finding branches…'
            : 'Find branches in your repos'}
        </Button>
      )}
      <LoadStatus state={found} loading="" />
      {byRepo && (
        <ul className="flex max-h-40 flex-wrap gap-1 overflow-y-auto">
          {branchCounts(byRepo).map((b) => (
            <li key={b.name}>
              <button
                type="button"
                className="rounded-full border px-2 py-0.5 hover:bg-muted"
                onClick={() => {
                  setPattern(b.name);
                }}
              >
                {b.name}{' '}
                <span className="text-muted-foreground">
                  {b.count}/{byRepo.size}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
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
        onReorder={(next) => {
          onChange({ ...dashboard, stages: next });
        }}
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
            <NativeSelect
              aria-label={`Source stage of ${stage.name}`}
              className="h-8 px-1"
              value={stage.sourceStageId ?? ''}
              onChange={(e) => {
                replace({
                  ...stage,
                  sourceStageId: e.target.value || undefined,
                });
              }}
            >
              <option value="">No source stage</option>
              {stages
                .filter((s) => !wouldCreateCycle(stages, stage.id, s.id))
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    Source: {s.name}
                  </option>
                ))}
            </NativeSelect>
            <DividerControl
              name={stage.name}
              divider={dashboard.columnDividers.find(
                (d) => d.beforeId === stage.id,
              )}
              onChange={(divider) => {
                onChange({
                  ...dashboard,
                  columnDividers: setDivider(
                    dashboard.columnDividers,
                    stage.id,
                    divider,
                  ),
                });
              }}
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
