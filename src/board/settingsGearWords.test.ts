/**
 * Tests for the board's settings places in words (spec.md §3.11): each
 * gear's accessible name and its popup's title, at every level.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { measureBoard } from '@/demo/scenarios/measure';

import { type BoardPlace, gearLabel, popupTitle } from './settingsGearWords';

describe('settings gear words', () => {
  it.each<[BoardPlace, string, string]>([
    [
      { level: 'row', rowId: 'api-core' },
      'Settings for row api-core',
      'Row settings: api-core',
    ],
    [
      { level: 'column', stageId: 'bali' },
      'Settings for stage Bali',
      'Stage settings: Bali',
    ],
    [
      { level: 'rowGroup', groupId: 'backend' },
      'Settings for row group Backend',
      'Row group settings: Backend',
    ],
    [
      { level: 'columnGroup', groupId: 'preview' },
      'Settings for column group Preview',
      'Column group settings: Preview',
    ],
    [
      { level: 'cell', rowId: 'api-core', stageId: 'bali' },
      'Settings for cell api-core, Bali',
      'Cell settings: api-core \u00d7 Bali',
    ],
  ])('names %j', (place, label, title) => {
    expect(gearLabel(measureBoard, place)).toBe(label);
    expect(popupTitle(measureBoard, place)).toBe(title);
  });
});
