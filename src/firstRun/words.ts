/**
 * The first run's words (spec.md §3.9, C-22): each step's place in the
 * walk-through, the presets as the stages step names them, the
 * suggestion, and what the board's note says of unmapped runs and rule
 * problems (the buttons' names it shows with their icons are in
 * `board/actionLabels.ts`).
 *
 * @module
 */
import { PROBLEMS, UNMAPPED_RUNS } from '@/board/actionLabels';
import {
  type BranchPresetId,
  BranchPresetIdSchema,
} from '@/domain/config/presets';
import { plural } from '@/lib/plural';

/** Creating a dashboard: token, repos, stages, then the board. */
const FIRST_RUN_STEPS = 4;

/** The line naming a step's place in the walk-through. */
export const stepOf = (step: number): string =>
  `Step ${String(step)} of ${String(FIRST_RUN_STEPS)}`;

/** The focused heading's look: no ring, since it isn't a control. */
export const STEP_HEADING_CLASS = 'font-semibold outline-none';

/** The presets' names, and the stages they create (§2.9). */
const PRESETS: Record<BranchPresetId, { name: string; stages: string }> = {
  'env-branches': {
    name: 'Environment branches',
    stages: 'dev, staging, prod (main)',
  },
  'gitflow-ish': { name: 'Gitflow', stages: 'develop, release/**, main' },
  'previews-release-train': {
    name: 'Release train',
    stages: 'dev, previews, release/**, main',
  },
  custom: { name: 'Blank', stages: 'add stages yourself' },
};

export const presetLabel = (id: BranchPresetId): string =>
  `${PRESETS[id].name}: ${PRESETS[id].stages}`;

/** The suggestion, said in a sentence. */
export const suggestionText = (
  presetId: BranchPresetId,
  repoCount: number,
): string =>
  presetId === 'custom'
    ? `No branch in your ${String(repoCount)} repos matches a preset, so the dashboard starts blank. Add stages from your branches in Edit dashboard, Stages.`
    : `Suggested from the branches in your ${String(repoCount)} repos: ${PRESETS[presetId].name}.`;

/** Every preset, in the order offered. */
export const PRESET_IDS: readonly BranchPresetId[] =
  BranchPresetIdSchema.options;

/** What the note says of the unmapped runs, when there are some: the
 * words before the button's name (`unmappedLabel`, shown with its icon,
 * spec 0.2.0 §3.A), and the words that follow the name directly (with
 * their own leading space). */
export const unmappedText = (
  unmapped: number,
): { before: string; after: string } => ({
  before: `${plural(unmapped, 'run lands', 'runs land')} in no cell:`,
  after: ' lists them, with a fix for each.',
});

/** What the note says while no run is unmapped (there's no button yet). */
export const NO_UNMAPPED_TEXT = `Runs that land in no cell will be listed under ${UNMAPPED_RUNS}.`;

/** What the note says of the rule problems, when there are some: the
 * words before the button's name (`problemsLabel`, shown with its icon,
 * spec 0.2.0 §3.A), and the words that follow the name directly. */
export const problemsText = (
  problems: number,
): { before: string; after: string } => ({
  before: `${plural(problems, 'rule problem is', 'rule problems are')} marked ! on the board and listed under`,
  after: '.',
});

/** What the note says while there are no rule problems (there's no
 * button yet). */
export const NO_PROBLEMS_TEXT = `No rule problems so far; any would be marked ! and listed under ${PROBLEMS}.`;
