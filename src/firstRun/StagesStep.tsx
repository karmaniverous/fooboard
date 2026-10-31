/**
 * First run, step 3 (spec.md §3.9, C-22, Decision 16): stages from the
 * branches in the chosen repos. The branches are found as the step opens
 * (`discoverBranches`); the best-fitting branch preset is suggested
 * (`suggestPreset`) and chosen, with the release train's preview stages
 * named from the repos' `preview/*` branches, all ticked. The user
 * adjusts by choosing another preset or unticking previews, and each
 * stage shows how many repos have a matching branch. Going on replaces
 * the dashboard's stages with these and opens its board (step 4).
 *
 * @module
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { ActionError } from '@/components/ActionError';
import { Button } from '@/components/ui/button';
import { useActionError } from '@/components/useActionError';
import type { Dashboard } from '@/domain/config/dashboard';
import {
  type BranchPresetId,
  buildPresetStages,
} from '@/domain/config/presets';
import { suggestPreset } from '@/domain/config/presetSuggestion';
import { discoverBranches } from '@/editors/branches';
import { LoadStatus } from '@/editors/LoadStatus';
import { useLoad } from '@/editors/useLoad';
import { dashboardPath } from '@/pages/paths';
import { useQueryEnv } from '@/query/queryEnvContext';

import { withStages } from './edits';
import { FIRST_RUN_STATE, firstRunPath, type SavedStepProps } from './paths';
import { PresetChoice } from './PresetChoice';
import { StagePreview } from './StagePreview';
import { StepFrame } from './StepFrame';

function StageChoices({
  dashboard,
  byRepo,
  onSave,
}: {
  dashboard: Dashboard;
  byRepo: ReadonlyMap<string, readonly string[]>;
  onSave: (dashboard: Dashboard) => void;
}): React.JSX.Element {
  const navigate = useNavigate();
  const [error, run] = useActionError();
  const suggestion = useMemo(() => suggestPreset(byRepo), [byRepo]);
  const [preset, setPreset] = useState<BranchPresetId>(suggestion.presetId);
  const [previews, setPreviews] = useState<readonly string[]>(
    suggestion.previewNames,
  );
  const stages = useMemo(
    () => buildPresetStages(preset, { previewNames: [...previews] }),
    [preset, previews],
  );
  return (
    <>
      <PresetChoice
        suggestion={suggestion}
        repoCount={byRepo.size}
        preset={preset}
        onPreset={setPreset}
        previews={previews}
        onPreviews={setPreviews}
      />
      <StagePreview stages={stages} byRepo={byRepo} />
      <ActionError error={error} />
      <div className="flex gap-2">
        <Link
          to={firstRunPath(dashboard.id, 'repos')}
          className="self-center text-sm underline underline-offset-2"
        >
          Back to repos
        </Link>
        <Button
          className="ml-auto"
          onClick={() => {
            run(() => {
              onSave(withStages(dashboard, stages));
              navigate(dashboardPath(dashboard.id), { state: FIRST_RUN_STATE });
            });
          }}
        >
          Show the board
        </Button>
      </div>
    </>
  );
}

export function StagesStep({
  dashboard: initial,
  onSave,
}: SavedStepProps): React.JSX.Element {
  // The step works from the dashboard it opened with, so finding repos
  // or branches runs once.
  const [dashboard] = useState(initial);
  const env = useQueryEnv();
  const [found, load] = useLoad<Map<string, string[]>>();
  const findBranches = useCallback(() => {
    load(() => discoverBranches(dashboard, env));
  }, [dashboard, env, load]);
  useEffect(findBranches, [findBranches]);
  return (
    <StepFrame step={3} title="Set up your stages">
      <p className="text-sm text-muted-foreground">
        Stages are the board&apos;s columns, each showing the runs on the
        branches it matches.
      </p>
      <LoadStatus
        state={found}
        loading="Finding the branches in your repos…"
        onRetry={findBranches}
      />
      {found.kind === 'done' && (
        <StageChoices
          dashboard={dashboard}
          byRepo={found.value}
          onSave={onSave}
        />
      )}
    </StepFrame>
  );
}
