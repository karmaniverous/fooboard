/**
 * The General tab's *While the tab is hidden* settings (spec §3.L,
 * Decision 113): the hidden polling period, in minutes, where each row's
 * hidden polling slows to, and the hidden polling ramp, in percent, how
 * much slower each hidden poll comes than the last. Stored as
 * `settings.hiddenPolling` (`periodMs`, `rampFactor`). A change applies at
 * once and refetches nothing.
 *
 * @module
 */
import { useId } from 'react';

import type { Dashboard } from '@/domain/config/dashboard';
import {
  clampHiddenPollMs,
  clampHiddenRamp,
  HIDDEN_POLL_MAX_MS,
  HIDDEN_POLL_MIN_MS,
  HIDDEN_RAMP_MAX,
  HIDDEN_RAMP_MIN,
  type HiddenPolling as Settings,
} from '@/domain/config/settings';

import { NumberSetting } from './NumberSetting';

/** Milliseconds in a minute, the period field's unit. */
const MINUTE_MS = 60_000;
/** A ramp factor's percent. */
const PERCENT = 100;
/** The fields show their values to two decimal places at most. */
const SHOWN = 100;

/** `value` rounded to what the fields show. */
const shown = (value: number): number => Math.round(value * SHOWN) / SHOWN;

/** A period (ms) in minutes, as the field shows it. */
const minutes = (ms: number): number => shown(ms / MINUTE_MS);
/** A ramp factor in percent, as the field shows it. */
const percent = (factor: number): number => shown(factor * PERCENT);

export function HiddenPolling({
  dashboard,
  onChange,
}: {
  dashboard: Dashboard;
  onChange: (dashboard: Dashboard) => void;
}): React.JSX.Element {
  const hint = useId();
  const { hiddenPolling } = dashboard.settings;
  const set = (change: Partial<Settings>) => {
    onChange({
      ...dashboard,
      settings: {
        ...dashboard.settings,
        hiddenPolling: { ...hiddenPolling, ...change },
      },
    });
  };
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="text-xs text-muted-foreground">
        While the tab is hidden
      </legend>
      <NumberSetting
        label="Hidden polling period (minutes)"
        value={minutes(hiddenPolling.periodMs)}
        min={minutes(HIDDEN_POLL_MIN_MS)}
        max={minutes(HIDDEN_POLL_MAX_MS)}
        hold={(typed) => minutes(clampHiddenPollMs(typed * MINUTE_MS))}
        describedBy={hint}
        onCommit={(value) => {
          set({ periodMs: clampHiddenPollMs(value * MINUTE_MS) });
        }}
      />
      <NumberSetting
        label="Hidden polling ramp (% per poll)"
        value={percent(hiddenPolling.rampFactor)}
        min={percent(HIDDEN_RAMP_MIN)}
        max={percent(HIDDEN_RAMP_MAX)}
        hold={(typed) => percent(clampHiddenRamp(typed / PERCENT))}
        describedBy={hint}
        onCommit={(value) => {
          set({ rampFactor: clampHiddenRamp(value / PERCENT) });
        }}
      />
      <p id={hint} className="text-xs text-muted-foreground">
        While this tab is hidden, every row keeps polling, each poll coming this
        much later than the last, from the row&apos;s usual interval until it
        reaches the period, from {minutes(HIDDEN_POLL_MIN_MS)} to{' '}
        {minutes(HIDDEN_POLL_MAX_MS)} minutes. The ramp is from{' '}
        {percent(HIDDEN_RAMP_MIN)}% to {percent(HIDDEN_RAMP_MAX)}%. Showing the
        tab again polls at the usual rate at once.
      </p>
    </fieldset>
  );
}
