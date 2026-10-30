/**
 * Tests for keys on arrival on the board (spec 0.2.0 §3.J): opened to ask
 * for a credential's secret, the board opens its credentials panel with
 * that credential expanded, and forgets the request at once, so a reload
 * or Back doesn't reopen the panel; an import that replaces the board
 * already open lands on it afresh, asking too; opened any other way, the
 * panel stays closed.
 *
 * @module
 */
import { act, fireEvent, screen } from '@testing-library/react';
import { cleanup } from '@testing-library/react';
import { useNavigate } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { DashboardSchema } from '@/domain/config/dashboard';
import { openCredentialState } from '@/firstRun/paths';
import { type AppStores, createAppStores } from '@/storage';
import { memoryStorage } from '@/storage/keyValue';
import { isOpen } from '@/test/openItem';
import { renderFirstRun } from '@/test/renderFirstRun';

/** Stores with a board naming two GitHub credentials, with no secrets. */
function storesWithKeys() {
  const stores = createAppStores(memoryStorage());
  stores.config.saveDashboard(
    DashboardSchema.parse({
      id: 'acme',
      name: 'Acme',
      credentials: [
        { id: 'gh-a', kind: 'github', label: 'acme A' },
        { id: 'gh-b', kind: 'github', label: 'acme B' },
      ],
      settings: { githubToken: 'gh-a' },
    }),
  );
  return stores;
}

const panel = () => screen.queryByRole('dialog', { name: 'Credentials' });

/** What an import that replaces `acme` does: saves the new one, then
 * lands on it asking for `gh-c` (`landingAfter`). */
function ReplaceAcme({ stores }: { stores: AppStores }): React.JSX.Element {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => {
        stores.config.saveDashboard(
          DashboardSchema.parse({
            id: 'acme',
            name: 'Acme v2',
            credentials: [
              { id: 'gh-a', kind: 'github', label: 'acme A' },
              { id: 'gh-c', kind: 'github', label: 'acme C' },
            ],
            settings: { githubToken: 'gh-c' },
          }),
        );
        navigate('/d/acme', { state: openCredentialState('gh-c') });
      }}
    >
      Replace acme
    </button>
  );
}

describe('keys on arrival', () => {
  it('opens the credentials panel on the credential asked for, once', async () => {
    const stores = await renderFirstRun(
      { pathname: '/d/acme', state: openCredentialState('gh-b') },
      storesWithKeys(),
    );
    expect(panel()).toBeVisible();
    expect(isOpen('acme B')).toBe(true);
    expect(isOpen('acme A')).toBe(false);
    // Forgotten at once: a reload or Back opens the board alone. A reload
    // reopens the entry with the state history now holds for it.
    const held: unknown = JSON.parse(
      screen.getByTestId('location-state').textContent,
    );
    cleanup();
    await act(async () => {
      await renderFirstRun({ pathname: '/d/acme', state: held }, stores);
    });
    expect(panel()).toBeNull();
    expect(screen.getByRole('heading', { name: 'Acme' })).toBeVisible();
    expect(held).toBeNull();
  });

  it('opens the panel on the imported board when an import replaces the one open', async () => {
    const stores = storesWithKeys();
    await renderFirstRun('/d/acme', stores, <ReplaceAcme stores={stores} />);
    expect(panel()).toBeNull();
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Replace acme' }));
    });
    expect(panel()).toBeVisible();
    // The imported dashboard's credentials, not the one it replaced.
    expect(isOpen('acme C')).toBe(true);
    expect(screen.queryByText('acme B')).toBeNull();
    expect(screen.getByTestId('location-state')).toHaveTextContent('null');
  });

  it('keeps the panel closed when the board is opened any other way', async () => {
    await renderFirstRun('/d/acme', storesWithKeys());
    expect(screen.getByRole('heading', { name: 'Acme' })).toBeVisible();
    expect(panel()).toBeNull();
  });
});
