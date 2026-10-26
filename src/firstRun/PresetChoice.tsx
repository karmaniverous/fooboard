/**
 * The stages step's choices (spec.md §3.9): the branch preset, the one
 * best fitting the repos' branches suggested and marked, and with the
 * release train, the preview stages named from `preview/*` branches,
 * each a checkbox.
 *
 * @module
 */
import { useId } from 'react';

import { CheckField } from '@/components/CheckField';
import { Choice } from '@/components/Choice';
import type { BranchPresetId } from '@/domain/config/presets';
import {
  type PresetSuggestion,
  PREVIEW_PRESET,
} from '@/domain/config/presetSuggestion';

import { PRESET_IDS, presetLabel, suggestionText } from './words';

export function PresetChoice({
  suggestion,
  repoCount,
  preset,
  onPreset,
  previews,
  onPreviews,
}: {
  suggestion: PresetSuggestion;
  repoCount: number;
  preset: BranchPresetId;
  onPreset: (preset: BranchPresetId) => void;
  /** The ticked preview names. */
  previews: readonly string[];
  onPreviews: (previews: readonly string[]) => void;
}): React.JSX.Element {
  const labelId = useId();
  return (
    <>
      <p role="status" className="text-sm">
        {suggestionText(suggestion.presetId, repoCount)}
      </p>
      <span id={labelId} className="text-sm font-medium">
        Starting stages
      </span>
      <Choice
        label="Starting stages"
        labelledBy={labelId}
        value={preset}
        options={PRESET_IDS.map((id) => ({
          value: id,
          label:
            id === suggestion.presetId
              ? `${presetLabel(id)} (suggested)`
              : presetLabel(id),
        }))}
        onValueChange={onPreset}
      />
      {preset === PREVIEW_PRESET && suggestion.previewNames.length > 0 && (
        <fieldset className="flex flex-col gap-1">
          <legend className="text-sm font-medium">
            Preview stages, from your preview/* branches
          </legend>
          {suggestion.previewNames.map((name) => (
            <CheckField
              key={name}
              label={`${name} (preview/${name})`}
              className="text-sm"
              checked={previews.includes(name)}
              onCheckedChange={(on) => {
                onPreviews(
                  suggestion.previewNames.filter((n) =>
                    n === name ? on : previews.includes(n),
                  ),
                );
              }}
            />
          ))}
        </fieldset>
      )}
    </>
  );
}
