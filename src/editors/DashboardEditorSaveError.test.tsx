/**
 * Tests for the dashboard editor's save-error alert: an edit whose save
 * throws (such as a full device store), or one the schema rejects, shows
 * *Not saved* with the reason and saves nothing; the next edit that saves
 * clears it.
 *
 * @module
 */
import { fireEvent, screen } from '@testing-library/react';
import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { type Dashboard, DashboardSchema } from '@/domain/config/dashboard';
import { branchRules } from '@/domain/config/placement';
import { createAppStores } from '@/storage';
import { memoryStorage } from '@/storage/keyValue';
import { StoresContext } from '@/storage/storesContext';
import { choose } from '@/test/choose';
import { envRender } from '@/test/envRender';

import { DashboardEditor } from './DashboardEditor';

const render = envRender();
const start = DashboardSchema.parse({
  id: 'd',
  name: 'Board',
  rows: [],
  stages: [],
});

/** What the store throws when the device is full. */
const quotaError = () =>
  Object.assign(new Error('The quota has been exceeded.'), {
    name: 'QuotaExceededError',
  });

/** The editor over `initial`, saving to a store whose saves fail while
 * `failing` is set. */
function setup(initial: Dashboard = start) {
  const store = { saved: initial, failing: false };
  function Harness(): React.JSX.Element {
    const [d, setD] = useState<Dashboard>(initial);
    return (
      <DashboardEditor
        dashboard={d}
        onChange={(next) => {
          if (store.failing) throw quotaError();
          store.saved = next;
          setD(next);
        }}
      />
    );
  }
  render(
    <StoresContext value={createAppStores(memoryStorage())}>
      <MemoryRouter>
        <Harness />
      </MemoryRouter>
    </StoresContext>,
  );
  return store;
}

const rename = (name: string) => {
  const input = screen.getByLabelText('Dashboard name');
  fireEvent.change(input, { target: { value: name } });
  fireEvent.blur(input);
};

describe('DashboardEditor save errors', () => {
  it('shows why a failed save was not saved, and clears once one saves', () => {
    const store = setup();
    store.failing = true;
    rename('Platform');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Not saved: QuotaExceededError: The quota has been exceeded.',
    );
    expect(store.saved.name).toBe('Board');

    store.failing = false;
    rename('Platform 2');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(store.saved.name).toBe('Platform 2');
  });

  it('says a setting that failed to save was not saved', () => {
    const store = setup({
      ...start,
      credentials: [{ id: 'k1', kind: 'aws', label: 'k1' }],
    });
    fireEvent.click(screen.getByRole('button', { name: /^Settings/ }));
    store.failing = true;
    choose(
      screen.getByRole('combobox', { name: 'AWS key for Dashboard Board' }),
      'k1',
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Not saved: QuotaExceededError: The quota has been exceeded.',
    );
    expect(store.saved.settings.awsKey).toBeUndefined();
  });

  it('refuses an edit the schema rejects, saying why', () => {
    // The editors' own controls can't produce an invalid dashboard, but a
    // dashboard that is already invalid (two stages with one id) can't be
    // saved with any edit.
    const stage = {
      id: 'dev',
      name: 'dev',
      rules: branchRules('dev'),
      settings: {},
    };
    const invalid = { ...start, stages: [stage, { ...stage }] };
    const store = setup(invalid);
    rename('Platform');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Not saved: duplicate stage id: dev',
    );
    expect(store.saved).toBe(invalid);
  });
});
