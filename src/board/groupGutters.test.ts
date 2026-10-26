/**
 * Tests for the group gutters (spec.md §3.7): column gutters only at group
 * boundaries (both sides of every column group, shared between adjacent
 * groups, at the board's edges too), a frame per column group spanning
 * gutter to gutter, row gutters only above unlabelled segments (a label
 * row is its boundary's gutter), what the layout counts, and the sizes.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import type { GroupSegment } from '@/domain/groups/segments';

import {
  boardGroups,
  columnTracks,
  FRAME_LINE_PX,
  GROUP_GUTTER_EM,
  gutterPx,
  rowLineInLabel,
  rowTracks,
  trackTemplate,
} from './groupGutters';

const g = { id: 'g' };
const h = { id: 'h' };

describe('columnTracks', () => {
  it.each<
    [string, GroupSegment<{ id: string }>[], ReturnType<typeof columnTracks>]
  >([
    [
      'no groups: no gutters, stages after the row names',
      [{ start: 0, span: 3 }],
      { stageColumn: [2, 3, 4], gutters: [], frames: [] },
    ],
    [
      'a group between ungrouped stages: a gutter on each side',
      [
        { start: 0, span: 1 },
        { group: g, start: 1, span: 2 },
        { start: 3, span: 2 },
      ],
      {
        stageColumn: [2, 4, 5, 7, 8],
        gutters: [3, 6],
        frames: [{ group: g, from: 3, to: 7 }],
      },
    ],
    [
      'groups at both edges: gutters beside the row names and at the end',
      [
        { group: g, start: 0, span: 2 },
        { start: 2, span: 1 },
        { group: h, start: 3, span: 2 },
      ],
      {
        stageColumn: [3, 4, 6, 8, 9],
        gutters: [2, 5, 7, 10],
        frames: [
          { group: g, from: 2, to: 6 },
          { group: h, from: 7, to: 11 },
        ],
      },
    ],
    [
      'adjacent groups share the gutter between them',
      [
        { group: g, start: 0, span: 2 },
        { group: h, start: 2, span: 1 },
      ],
      {
        stageColumn: [3, 4, 6],
        gutters: [2, 5, 7],
        frames: [
          { group: g, from: 2, to: 6 },
          { group: h, from: 5, to: 8 },
        ],
      },
    ],
    [
      'a single-member group is framed round its one stage',
      [
        { start: 0, span: 1 },
        { group: g, start: 1, span: 1 },
        { start: 2, span: 1 },
      ],
      {
        stageColumn: [2, 4, 6],
        gutters: [3, 5],
        frames: [{ group: g, from: 3, to: 6 }],
      },
    ],
  ])('%s', (_, segments, expected) => {
    expect(columnTracks(segments)).toEqual(expected);
  });

  it('never puts a stage in a gutter, and every frame starts and ends on one', () => {
    const tracks = columnTracks([
      { start: 0, span: 2 },
      { group: g, start: 2, span: 1 },
      { group: h, start: 3, span: 3 },
      { start: 6, span: 1 },
    ]);
    const gutters = new Set(tracks.gutters);
    expect(tracks.stageColumn.some((c) => gutters.has(c))).toBe(false);
    for (const f of tracks.frames) {
      expect(gutters.has(f.from)).toBe(true);
      expect(gutters.has(f.to - 1)).toBe(true);
    }
  });
});

describe('rowTracks', () => {
  const label = (id: string) => ({ id, label: id.toUpperCase() });
  it('puts a gutter only above an unlabelled segment after the first', () => {
    expect(
      rowTracks(
        [
          { group: label('a'), start: 0, span: 2 },
          { start: 2, span: 1 },
          { group: { id: 'b' }, start: 3, span: 1 },
          { group: label('c'), start: 4, span: 1 },
        ],
        true,
      ),
    ).toEqual([
      'line', // the label strip
      'line', // the stage headers
      'line', // A's label row
      'cell',
      'cell',
      'gutter',
      'cell',
      'gutter',
      'cell',
      'line', // C's label row, its boundary's gutter
      'cell',
    ]);
  });

  it('has no strip row without a labelled column group, and no gutter above the first segment', () => {
    expect(
      rowTracks([{ group: { id: 'a' }, start: 0, span: 1 }], false),
    ).toEqual(['line', 'cell']);
  });
});

describe('boardGroups', () => {
  const ids = (n: number, p: string) =>
    Array.from({ length: n }, (_, i) => ({ id: `${p}${String(i)}` }));
  it('counts label rows and gutters as the grid lays them', () => {
    const groups = boardGroups({
      rows: ids(6, 'r'),
      stages: ids(4, 's'),
      rowGroups: [
        {
          id: 'a',
          label: 'A',
          memberIds: ['r0', 'r1'],
          settings: {},
          stageRules: {},
          rowRules: {},
        },
        {
          id: 'b',
          memberIds: ['r3'],
          settings: {},
          stageRules: {},
          rowRules: {},
        },
        {
          id: 'c',
          label: 'C',
          memberIds: ['r4', 'r5'],
          settings: {},
          stageRules: {},
          rowRules: {},
        },
      ],
      columnGroups: [
        {
          id: 'p',
          label: 'P',
          memberIds: ['s1', 's2'],
          settings: {},
          stageRules: {},
        },
      ],
    });
    expect(groups).toMatchObject({
      strip: true,
      // The strip, A's label and C's.
      labelRows: 3,
      // Either side of P.
      columnGutters: 2,
      // Above the ungrouped r2 and above b; C's label row is its gutter.
      rowGutters: 2,
    });
    expect(groups.rowSegments).toHaveLength(4);
    expect(groups.columnSegments).toHaveLength(3);
  });

  it('has no strip, label rows or gutters without groups', () => {
    expect(
      boardGroups({
        rows: ids(2, 'r'),
        stages: ids(2, 's'),
        rowGroups: [],
        columnGroups: [],
      }),
    ).toMatchObject({
      strip: false,
      labelRows: 0,
      columnGutters: 0,
      rowGutters: 0,
    });
  });
});

describe('sizes', () => {
  it('scales the gutter with the text, never narrower than its line', () => {
    expect(gutterPx(13)).toBeCloseTo(13 * GROUP_GUTTER_EM);
    expect(gutterPx(26)).toBeCloseTo(2 * gutterPx(13));
    expect(gutterPx(1)).toBe(FRAME_LINE_PX);
  });

  it('centres a label row line between the cards above and the label', () => {
    // Default density at 100%: padY 4.55 px, gap 3 px. The band is the gap
    // plus the label row's top padding twice over (the label sits at the
    // bottom); the line's middle is the band's.
    const top = rowLineInLabel(4.55, 3);
    expect(3 + top + FRAME_LINE_PX / 2).toBeCloseTo((3 + 2 * 4.55) / 2);
  });

  it('writes a template in px', () => {
    expect(trackTemplate([120, 5.2, 100])).toBe('120px 5.2px 100px');
  });
});
