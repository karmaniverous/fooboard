/**
 * *Dismissed unmapped runs* on the editor's *General* tab (spec 0.2.0
 * §3.I): each pattern is a collapsing item named by its fields; a field
 * edits, a cleared field is removed, *Remove* drops the pattern, and
 * clearing a pattern's last field is refused with *Not saved*.
 *
 * @module
 */
import { fireEvent, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { type Dashboard, DashboardSchema } from '@/domain/config/dashboard';
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
  unmappedDismissals: [
    { id: 'a', where: 'acme/api', workflow: 'Deploy' },
    { id: 'b', branch: 'feature/*' },
  ],
});

/** The editor over `start`; returns what was last saved. */
function setup(): { saved: Dashboard } {
  const store = { saved: start };
  function Harness(): React.JSX.Element {
    const [d, setD] = useState<Dashboard>(start);
    return (
      <DashboardEditor
        dashboard={d}
        onChange={(next) => {
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

const section = () =>
  screen.getByRole('region', { name: 'Dismissed unmapped runs' });
const open = (name: string) => {
  fireEvent.click(within(section()).getByRole('button', { name }));
  return within(section()).getByRole('region', { name: `Dismissal ${name}` });
};
const commit = (item: HTMLElement, label: string, value: string) => {
  const input = within(item).getByRole('textbox', { name: label });
  fireEvent.change(input, { target: { value } });
  fireEvent.blur(input);
};

describe('the editor’s dismissed unmapped runs', () => {
  it('names each pattern by its fields', () => {
    setup();
    expect(
      within(section()).getByRole('button', {
        name: 'Repo or app acme/api, Workflow Deploy',
      }),
    ).toBeVisible();
    expect(
      within(section()).getByRole('button', {
        name: 'Branch pattern feature/*',
      }),
    ).toBeVisible();
  });

  it('edits a field, removes a cleared one, and sets a reason', () => {
    const store = setup();
    const item = open('Repo or app acme/api, Workflow Deploy');
    commit(item, 'Branch pattern', 'release/**');
    commit(item, 'Workflow', '');
    choose(within(item).getByRole('combobox'), 'no order key');
    expect(store.saved.unmappedDismissals[0]).toEqual({
      id: 'a',
      where: 'acme/api',
      branch: 'release/**',
      reason: 'no-order-key',
    });
  });

  it('removes a pattern', () => {
    const store = setup();
    fireEvent.click(
      within(section()).getByRole('button', {
        name: 'Remove Branch pattern feature/*',
      }),
    );
    expect(store.saved.unmappedDismissals.map((d) => d.id)).toEqual(['a']);
  });

  it('refuses clearing a pattern’s last field, Not saved', () => {
    const store = setup();
    const item = open('Branch pattern feature/*');
    commit(item, 'Branch pattern', '');
    expect(screen.getByRole('alert')).toHaveTextContent(/Not saved/);
    expect(store.saved.unmappedDismissals[1]).toEqual({
      id: 'b',
      branch: 'feature/*',
    });
  });
});
