/**
 * The board's compact toolbar (spec.md C-13): the summary chips, density
 * (three icons) and zoom (-, a percentage field, +, back to 100%). Laid
 * out by measuring its content: wide, the summary at the left, density
 * centred and zoom at the right; narrow, the summary on its own line
 * (dropping the chip words before they would wrap), then density left and
 * zoom right.
 *
 * @module
 */
import { Maximize2, Minimize2, Minus, Plus, RotateCcw } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { WithTooltip } from '@/components/ui/tooltip';
import type { Density } from '@/domain/config/devicePreferences';
import { measuredWidth, useMeasured } from '@/lib/useMeasured';
import { cn, PINNED_X } from '@/lib/utils';

import { snapZoom, zoomLabel, type ZoomRange } from './zoom';

const DENSITIES: Density[] = ['compact', 'default', 'comfortable'];
const DENSITY_ICON = {
  compact: Minimize2,
  default: Minus,
  comfortable: Maximize2,
} as const;
/** `gap-x-2` in px. */
const TOOLBAR_GAP_PX = 8;

function ZoomField({
  zoom,
  range,
  onZoom,
}: {
  zoom: number;
  range: ZoomRange;
  onZoom: (zoom: number) => void;
}): React.JSX.Element {
  const label = zoomLabel(zoom, range);
  const [draft, setDraft] = useState<string | null>(null);
  const apply = () => {
    if (draft === null) return;
    const value = Number.parseFloat(draft);
    if (Number.isFinite(value)) onZoom(snapZoom(value / 100, range));
    setDraft(null);
  };
  return (
    <input
      aria-label="Zoom"
      inputMode="numeric"
      className="h-6 w-14 rounded-md border border-input bg-background px-1 text-center text-xs tabular-nums"
      value={draft ?? label}
      onFocus={(e) => {
        setDraft(label.replace('%', ''));
        e.currentTarget.select();
      }}
      onChange={(e) => {
        setDraft(e.currentTarget.value);
      }}
      onBlur={apply}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          apply();
          e.currentTarget.blur();
        } else if (e.key === 'Escape') {
          setDraft(null);
          e.currentTarget.blur();
        }
      }}
    />
  );
}

export function BoardToolbar({
  zoom,
  range,
  onZoom,
  onStep,
  density,
  onDensity,
  lead,
}: {
  zoom: number;
  range: ZoomRange;
  onZoom: (zoom: number) => void;
  /** One zoom step out (-1) or in (1). */
  onStep: (direction: 1 | -1) => void;
  density: Density;
  onDensity: (density: Density) => void;
  /** Start of the toolbar: the summary chips (C-14a). */
  lead?: (options: { words: boolean }) => React.ReactNode;
}): React.JSX.Element {
  // Wide when the summary and zoom each fit half of what is left beside
  // the centred density control; else narrow, dropping the chip words
  // ("tight") when the worded chips would not fit one line.
  const [toolbar, mode] = useMeasured<
    HTMLDivElement,
    'wide' | 'narrow' | 'tight'
  >((el) => {
    const lead = measuredWidth(el, 'lead');
    const side = Math.max(lead, measuredWidth(el, 'zoom'));
    const width = el.clientWidth;
    if (2 * side + measuredWidth(el, 'density') + 2 * TOOLBAR_GAP_PX <= width)
      return 'wide';
    return lead <= width ? 'narrow' : 'tight';
  }, 'wide');
  return (
    <div ref={toolbar} className={cn('relative text-xs', PINNED_X)}>
      {lead && (
        // The measuring copy is clipped: its natural width must never
        // widen the page (C-13: no horizontal scroll on a phone).
        <div
          aria-hidden
          inert
          data-testid="toolbar-measure"
          className="invisible absolute inset-0 overflow-hidden"
        >
          <div data-measure="lead" className="w-max">
            {lead({ words: true })}
          </div>
        </div>
      )}
      <div
        className={cn(
          'grid items-center gap-x-2 gap-y-1',
          mode === 'wide' ? 'grid-cols-[1fr_auto_1fr]' : 'grid-cols-[1fr_auto]',
        )}
      >
        <div
          className={cn('justify-self-start', mode !== 'wide' && 'col-span-2')}
        >
          {lead?.({ words: mode !== 'tight' })}
        </div>
        <div
          role="group"
          aria-label="Density"
          data-measure="density"
          className={cn(
            'inline-flex overflow-hidden rounded-md border',
            mode === 'wide' ? 'justify-self-center' : 'justify-self-start',
          )}
        >
          <ToggleGroup
            type="single"
            value={density}
            onValueChange={(v) => {
              // Re-pressing the current density leaves it chosen.
              const next = DENSITIES.find((d) => d === v);
              if (next) onDensity(next);
            }}
          >
            {DENSITIES.map((d) => {
              const Icon = DENSITY_ICON[d];
              return (
                <WithTooltip
                  key={d}
                  label={d.charAt(0).toUpperCase() + d.slice(1)}
                >
                  <ToggleGroupItem
                    value={d}
                    aria-label={d}
                    className="flex h-6 w-7 items-center justify-center"
                  >
                    <Icon aria-hidden className="size-3.5" />
                  </ToggleGroupItem>
                </WithTooltip>
              );
            })}
          </ToggleGroup>
        </div>
        <div
          data-measure="zoom"
          className="flex items-center gap-0.5 justify-self-end"
        >
          <WithTooltip label="Zoom out">
            <Button
              size="icon"
              variant="outline"
              className="size-6"
              aria-label="Zoom out"
              disabled={zoom <= range.min}
              onClick={() => {
                onStep(-1);
              }}
            >
              <Minus className="size-3.5" />
            </Button>
          </WithTooltip>
          <ZoomField zoom={zoom} range={range} onZoom={onZoom} />
          <WithTooltip label="Zoom in">
            <Button
              size="icon"
              variant="outline"
              className="size-6"
              aria-label="Zoom in"
              disabled={zoom >= range.max}
              onClick={() => {
                onStep(1);
              }}
            >
              <Plus className="size-3.5" />
            </Button>
          </WithTooltip>
          <WithTooltip label="Zoom to 100%">
            <Button
              size="icon"
              variant="outline"
              className="size-6"
              aria-label="Zoom to 100%"
              disabled={zoom === 1}
              onClick={() => {
                onZoom(1);
              }}
            >
              <RotateCcw className="size-3.5" />
            </Button>
          </WithTooltip>
        </div>
      </div>
    </div>
  );
}
