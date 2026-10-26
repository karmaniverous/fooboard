/**
 * Layout test inputs (spec.md C-13): a fixed-width text measure, a cell's
 * contents at each rung, and a 1440 x 800 board of 10 rows and 6 stages
 * to vary.
 *
 * @module
 */
import type { LayoutInput, Rung } from '@/board/layout';
import type { Content } from '@/board/packing';

/** Every character is 0.6 em wide. */
export const measure = (text: string, px: number): number =>
  text.length * px * 0.6;

export const cell = (rung: Rung): Content => ({
  lead: rung === 0 ? 'x' : 'x Cancelled',
  items: [
    ...(rung >= 2 ? [{ key: 'time' as const, text: '59m' }] : []),
    ...(rung >= 3
      ? [
          { key: 'commit' as const, text: '0000000' },
          { key: 'extra' as const, text: 'deploy' },
        ]
      : []),
    ...(rung >= 4
      ? [{ key: 'branch' as const, text: 'release/24.3', free: true }]
      : []),
    ...(rung >= 5
      ? [
          {
            key: 'message' as const,
            text: 'Fix flaky checkout test',
            free: true,
          },
        ]
      : []),
  ],
});

export const input = (over: Partial<LayoutInput> = {}): LayoutInput => ({
  width: 1440,
  height: 800,
  rows: 10,
  stages: 6,
  labelRows: 0,
  columnGutters: 0,
  rowGutters: 0,
  rowNames: ['api-core'],
  contents: (rung) => [cell(rung)],
  measure,
  density: 'default',
  headerGears: true,
  ...over,
});
