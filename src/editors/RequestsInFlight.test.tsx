/**
 * Tests for the *requests in flight* setting (spec.md §3.1, Decision 28):
 * one number per platform, 10 by default, held to 1–100 when committed on
 * blur or Enter, explained by help text, and shown in the General tab.
 *
 * @module
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { type Dashboard, DashboardSchema } from '@/domain/config/dashboard';
import {
  DEFAULT_REQUESTS_IN_FLIGHT,
  REQUESTS_IN_FLIGHT_MAX,
  REQUESTS_IN_FLIGHT_MIN,
} from '@/domain/config/settings';

import { setup as setupEditor, tab } from './editorSectionsHarness';
import { RequestsInFlight } from './RequestsInFlight';

const board = DashboardSchema.parse({ id: 'd', name: 'Board' });
const GITHUB = 'GitHub requests in flight';
const AWS = 'AWS requests in flight';

function setup() {
  const onChange = vi.fn<(next: Dashboard) => void>();
  function Harness(): React.JSX.Element {
    const [d, setD] = useState(board);
    return (
      <RequestsInFlight
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
  return { onChange, field, enter };
}

const inFlight = (d: Dashboard | undefined) => d?.settings.requestsInFlight;

describe('RequestsInFlight', () => {
  it('shows the default for each platform, with help text', () => {
    const { field } = setup();
    for (const name of [GITHUB, AWS]) {
      expect(field(name)).toHaveValue(DEFAULT_REQUESTS_IN_FLIGHT);
      expect(field(name)).toHaveAccessibleDescription(
        /each credential may have running at once/,
      );
    }
  });

  it('commits a value on blur or Enter, per platform', () => {
    const { onChange, enter } = setup();
    enter(GITHUB, '25', 'blur');
    expect(inFlight(onChange.mock.lastCall?.[0])).toEqual({
      github: 25,
      aws: DEFAULT_REQUESTS_IN_FLIGHT,
    });
    enter(AWS, '3', 'enter');
    expect(inFlight(onChange.mock.lastCall?.[0])).toEqual({
      github: 25,
      aws: 3,
    });
  });

  it.each([
    ['0', REQUESTS_IN_FLIGHT_MIN],
    ['500', REQUESTS_IN_FLIGHT_MAX],
    ['7.6', 8],
  ])('holds %s to %i', (typed, kept) => {
    const { onChange, enter, field } = setup();
    enter(GITHUB, typed, 'blur');
    expect(inFlight(onChange.mock.lastCall?.[0])?.github).toBe(kept);
    expect(field(GITHUB)).toHaveValue(kept);
  });

  it('keeps the value for an empty or unchanged entry, saving nothing', () => {
    const { onChange, enter, field } = setup();
    enter(GITHUB, String(DEFAULT_REQUESTS_IN_FLIGHT), 'blur');
    enter(GITHUB, 'abc', 'blur');
    expect(onChange).not.toHaveBeenCalled();
    expect(field(GITHUB)).toHaveValue(DEFAULT_REQUESTS_IN_FLIGHT);
  });

  it('edits the dashboard from the General tab', () => {
    const latest = setupEditor();
    tab('General');
    const field = screen.getByRole('spinbutton', { name: GITHUB });
    fireEvent.change(field, { target: { value: '12' } });
    fireEvent.blur(field);
    expect(latest.current.settings.requestsInFlight.github).toBe(12);
  });
});
