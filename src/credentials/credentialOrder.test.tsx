/**
 * Tests for the display order of credentials (spec.md C-1a): by name,
 * ignoring case, ties by id, in the credentials panel (the dashboard's own
 * and those to copy from another dashboard) and in the credential pickers;
 * the stored order is left alone.
 *
 * @module
 */
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { DashboardSchema } from '@/domain/config/dashboard';
import { CredentialSelect } from '@/editors/CredentialSelect';
import { createAppStores } from '@/storage';
import { memoryStorage } from '@/storage/keyValue';
import { StoresContext } from '@/storage/storesContext';
import { optionsOf } from '@/test/choose';

import { sortByCredential, sortCredentials } from './credentialOrder';
import { CredentialsPanel } from './CredentialsPanel';

/** Stored out of order, with two names equal but for case (id `a` sorts before `b`). */
const stored = [
  { id: 'c', kind: 'github', label: 'beta-key' },
  { id: 'b', kind: 'github', label: 'alpha-key' },
  { id: 'a', kind: 'github', label: 'Alpha-key' },
  { id: 'd', kind: 'github', label: 'Gamma-key' },
] as const;
const expected = ['Alpha-key', 'alpha-key', 'beta-key', 'Gamma-key'];

const dashboard = DashboardSchema.parse({
  id: 'd',
  name: 'D',
  credentials: stored,
});

/** The labels in `items`, in order, from those of `stored`. */
const labelsIn = (items: HTMLElement[]) =>
  items.map(
    (li) => stored.find((c) => li.textContent.includes(c.label))?.label,
  );

describe('sortCredentials', () => {
  it('sorts by name ignoring case, ties by id, leaving the input alone', () => {
    const list = [...dashboard.credentials];
    expect(sortCredentials(list).map((c) => c.label)).toEqual(expected);
    expect(list).toEqual(dashboard.credentials);
  });

  it('gives the same order whatever the input order', () => {
    const reversed = [...dashboard.credentials].reverse();
    expect(sortCredentials(reversed).map((c) => c.id)).toEqual(
      sortCredentials(dashboard.credentials).map((c) => c.id),
    );
  });

  it('sorts other items by their credential', () => {
    const items = dashboard.credentials.map((c) => ({ credential: c }));
    expect(
      sortByCredential(items, (i) => i.credential).map(
        (i) => i.credential.label,
      ),
    ).toEqual(expected);
  });
});

describe('credential lists', () => {
  it('lists the dashboard credentials and those to copy by name', () => {
    const stores = createAppStores(memoryStorage());
    const other = DashboardSchema.parse({
      id: 'o',
      name: 'Other',
      credentials: stored.map((c) => ({ ...c, id: `o-${c.id}` })),
    });
    for (const c of other.credentials)
      stores.credentials.set(c.id, { kind: 'github', token: 't' }, false);
    render(
      <StoresContext value={stores}>
        <MemoryRouter>
          <CredentialsPanel
            dashboard={dashboard}
            otherDashboards={[other]}
            onChange={() => undefined}
          />
        </MemoryRouter>
      </StoresContext>,
    );
    const [own] = screen.getAllByRole('list');
    expect(labelsIn(within(own).getAllByRole('listitem'))).toEqual(expected);
    const copy = screen.getByRole('heading', {
      name: 'Copy from another dashboard',
    }).parentElement;
    if (!copy) throw new Error('no copy section');
    expect(labelsIn(within(copy).getAllByRole('listitem'))).toEqual(expected);
  });

  it('offers credentials in a picker by name', () => {
    render(
      <CredentialSelect
        dashboard={dashboard}
        kind="github"
        value={undefined}
        onChange={() => undefined}
        label="GitHub token for api"
        unset={{ label: 'None (no default is set)' }}
      />,
    );
    expect(
      optionsOf(screen.getByRole('combobox', { name: 'GitHub token for api' })),
    ).toEqual(['None (no default is set)', ...expected]);
  });
});
