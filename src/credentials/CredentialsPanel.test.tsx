/**
 * Tests for the credentials panel: adding a token keeps the secret in the
 * store (tab-only unless remembered) and only its id and label in the
 * dashboard; forgetting asks for the secret again; removal is confirmed;
 * copying from another dashboard makes an independent credential; and an
 * approaching expiry is flagged.
 *
 * @module
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { type Dashboard, DashboardSchema } from '@/domain/config/dashboard';
import { type AppStores, createAppStores } from '@/storage';
import { memoryStorage } from '@/storage/keyValue';
import { StoresContext } from '@/storage/storesContext';

import { CredentialsPanel } from './CredentialsPanel';

const blank = DashboardSchema.parse({ id: 'd', name: 'D' });

function setup({
  initial = blank,
  others = [],
  expiry,
  seed,
}: {
  initial?: Dashboard;
  others?: Dashboard[];
  expiry?: string;
  seed?: (stores: AppStores) => void;
} = {}) {
  const stores = createAppStores(memoryStorage());
  seed?.(stores);
  const latest = { current: initial };
  function Harness(): React.JSX.Element {
    const [dashboard, setDashboard] = useState(initial);
    return (
      <CredentialsPanel
        dashboard={dashboard}
        otherDashboards={others}
        tokenExpiry={() => expiry}
        onChange={(next) => {
          latest.current = DashboardSchema.parse(next);
          setDashboard(next);
        }}
      />
    );
  }
  render(
    <StoresContext value={stores}>
      <MemoryRouter>
        <Harness />
      </MemoryRouter>
    </StoresContext>,
  );
  return { stores, latest };
}

const addToken = (name: string, token: string, remember = false) => {
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: name } });
  fireEvent.change(screen.getByLabelText('Token'), {
    target: { value: token },
  });
  if (remember)
    fireEvent.click(screen.getByLabelText(/Remember on this device/));
  fireEvent.click(screen.getByRole('button', { name: 'Add' }));
};

describe('CredentialsPanel', () => {
  it('stores the secret apart from the dashboard, as the default', () => {
    const { stores, latest } = setup();
    expect(screen.getByText(/If this token leaks/)).toBeInTheDocument();
    addToken('acme', 'github_pat_1');
    const [ref] = latest.current.credentials;
    expect(ref).toMatchObject({ kind: 'github', label: 'acme' });
    expect(latest.current.defaultCredentials.github).toBe(ref.id);
    expect(JSON.stringify(latest.current)).not.toContain('github_pat_1');
    expect(stores.credentials.get(ref.id)).toEqual({
      kind: 'github',
      token: 'github_pat_1',
    });
    expect(screen.getByText(/this tab only/)).toBeInTheDocument();
  });

  it('asks for the secret again after Forget, and confirms removal', () => {
    const { latest } = setup();
    addToken('acme', 'github_pat_1', true);
    expect(screen.getByText(/remembered on this device/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Forget' }));
    expect(screen.getByText(/not entered on this device/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(latest.current.credentials).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Remove acme' }));
    expect(latest.current.credentials).toHaveLength(0);
    expect(latest.current.defaultCredentials.github).toBeUndefined();
  });

  it('copies a credential from another dashboard as an independent one', () => {
    const other = DashboardSchema.parse({
      id: 'o',
      name: 'Other',
      credentials: [{ id: 'src', kind: 'github', label: 'shared' }],
      defaultCredentials: { github: 'src' },
    });
    const { stores, latest } = setup({
      others: [other],
      seed: (st) => {
        st.credentials.set('src', { kind: 'github', token: 't' }, false);
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    const copy = latest.current.credentials[0];
    expect(copy.id).not.toBe('src');
    stores.credentials.forget('src');
    expect(stores.credentials.get(copy.id)).toEqual({
      kind: 'github',
      token: 't',
    });
  });

  it('flags a token close to expiry', () => {
    setup({ expiry: new Date(Date.now() + 3 * 864e5).toISOString() });
    addToken('acme', 'github_pat_1');
    expect(screen.getByText(/Expires in 3 days/)).toBeInTheDocument();
  });
});
