/**
 * Tests for the General tab's *While the tab is hidden* settings (spec
 * §3.L, Decision 113): the hidden polling period in minutes and the ramp
 * in percent, defaults shown, each committed on blur or Enter, held to its
 * range, keeping the other field and the other settings.
 *
 * @module
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { type Dashboard, DashboardSchema } from '@/domain/config/dashboard';
import {
  DEFAULT_HIDDEN_POLL_MS,
  DEFAULT_HIDDEN_RAMP,
  DEFAULT_REQUESTS_IN_FLIGHT,
} from '@/domain/config/settings';

import { setup as setupEditor, tab } from './editorSectionsHarness';
import { HiddenPolling } from './HiddenPolling';

const board = DashboardSchema.parse({ id: 'd', name: 'Board' });
const PERIOD = 'Hidden polling period (minutes)';
const RAMP = 'Hidden polling ramp (% per poll)';

function setup() {
  const onChange = vi.fn<(next: Dashboard) => void>();
  function Harness(): React.JSX.Element {
    const [d, setD] = useState(board);
    return (
      <HiddenPolling
        dashboard={d}
        onChange={(next) => {
          onChange(next);
          setD(next);
        }}
      />
    );
  }
  render(<Harness />);
  const field = (name: string) => screen.getByRole('spinbutton', { name });
  const enter = (name: string, value: string, commit: 'blur' | 'enter') => {
    fireEvent.change(field(name), { target: { value } });
    if (commit === 'blur') fireEvent.blur(field(name));
    else fireEvent.keyDown(field(name), { key: 'Enter' });
  };
  const last = () => onChange.mock.lastCall?.[0].settings;
  return { onChange, field, enter, last };
}

describe('HiddenPolling', () => {
  it('shows the defaults in minutes and percent, with help text', () => {
    const { field } = setup();
    expect(field(PERIOD)).toHaveValue(DEFAULT_HIDDEN_POLL_MS / 60_000);
    expect(field(RAMP)).toHaveValue(DEFAULT_HIDDEN_RAMP * 100);
    for (const name of [PERIOD, RAMP])
      expect(field(name)).toHaveAccessibleDescription(
        /every row keeps polling/,
      );
  });

  it('commits each field in its own unit, keeping the other', () => {
    const { enter, last } = setup();
    enter(PERIOD, '10', 'blur');
    expect(last()?.hiddenPolling).toEqual({
      periodMs: 600_000,
      rampFactor: DEFAULT_HIDDEN_RAMP,
    });
    enter(RAMP, '50', 'enter');
    expect(last()?.hiddenPolling).toEqual({
      periodMs: 600_000,
      rampFactor: 0.5,
    });
    expect(last()?.requestsInFlight.github).toBe(DEFAULT_REQUESTS_IN_FLIGHT);
  });

  it.each([
    [PERIOD, '0', 1, { periodMs: 60_000 }],
    [PERIOD, '500', 60, { periodMs: 3_600_000 }],
    [PERIOD, '2.5', 2.5, { periodMs: 150_000 }],
    [RAMP, '0', 1, { rampFactor: 0.01 }],
    [RAMP, '400', 100, { rampFactor: 1 }],
  ])('holds %s at %s to %s', (name, typed, shown, stored) => {
    const { enter, field, last } = setup();
    enter(name, typed, 'blur');
    expect(field(name)).toHaveValue(shown);
    expect(last()?.hiddenPolling).toMatchObject(stored);
  });

  it('keeps the value for an empty or unchanged entry, saving nothing', () => {
    const { onChange, enter, field } = setup();
    enter(PERIOD, '5', 'blur');
    enter(RAMP, 'abc', 'blur');
    expect(onChange).not.toHaveBeenCalled();
    expect(field(RAMP)).toHaveValue(25);
  });

  it('edits the dashboard from the General tab', () => {
    const latest = setupEditor();
    tab('General');
    const field = screen.getByRole('spinbutton', { name: PERIOD });
    fireEvent.change(field, { target: { value: '15' } });
    fireEvent.blur(field);
    expect(latest.current.settings.hiddenPolling.periodMs).toBe(900_000);
  });
});
