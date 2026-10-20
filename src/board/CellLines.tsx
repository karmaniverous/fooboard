/**
 * A cell's content laid out by the board's line map (spec.md C-13): the
 * lead and items packed into lines, each line cut off rather than wrapped.
 *
 * @module
 */

import { Fragment } from 'react';

import { cn } from '@/lib/utils';

import { gapStyle } from './cellStyles';
import { type ItemKey, type LineMap } from './packing';

/** One item of a cell's content, keyed for the line map. */
export interface Keyed {
  key: ItemKey;
  node: React.ReactNode;
  free?: boolean;
}

/** Arrange the lead and items by the board's line map (C-13): the lead on
 * line 0, each item on its line. Fixed items keep their width; free text
 * takes what is left and is cut off. */
export function Lines({
  lineOf,
  lead,
  items,
  center = false,
}: {
  /** Centre the content horizontally (rung 0, icons only). */
  center?: boolean;
  lineOf: LineMap;
  lead: React.ReactNode;
  items: Keyed[];
}): React.JSX.Element {
  const line = 'flex min-w-0 items-center overflow-hidden whitespace-nowrap';
  const lines: React.ReactNode[][] = [[<Fragment key="lead">{lead}</Fragment>]];
  for (const item of items) {
    const n = lineOf[item.key] ?? 0;
    while (lines.length <= n) lines.push([]);
    lines[n]?.push(
      <span
        key={item.key}
        className={item.free ? 'flex min-w-0 flex-1' : 'flex flex-none'}
      >
        {item.node}
      </span>,
    );
  }
  return (
    <span className="flex min-w-0 flex-1 flex-col justify-center">
      {lines.map((content, i) =>
        content.length === 0 ? null : (
          // Lines are positional and never reorder.
          <span
            key={i}
            className={cn(line, center && 'justify-center')}
            style={gapStyle}
          >
            {content}
          </span>
        ),
      )}
    </span>
  );
}
