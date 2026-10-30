/**
 * Tests for keys on arrival on the board (spec 0.2.0 §3.J): opened to ask
 * for a credential's secret, the board opens its credentials panel with
 * that credential expanded, and forgets the request at once, so a reload
 * or Back doesn't reopen the panel; opened any other way, the panel stays
 * closed.
 *
 * @module
 */
import { act, screen } from '@testing-library/react';
import { cleanup } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DashboardSchema } from '@/domain/config/dashboard';
import { openCredentialState } from '@/firstRun/paths';
import { createAppStores } from '@/storage';
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

describe('keys on arrival', () => {
  it('opens the credentials panel on the credential asked for, once', async () => {
    const stores = await renderFirstRun(
      { pathname: '/d/acme', state: openCredentialState('gh-b') },
      storesWithKeys(),
    );
    expect(panel()).toBeVisible();
    expect(isOpen('acme B')).toBe(true);
    expect(isOpen('acme A')).toBe(false);
    // Forgotten at once: a reload or Back opens the board alone.
    expect(screen.getByTestId('location-state')).toHaveTextContent('null');
    cleanup();
    await act(async () => {
      await renderFirstRun('/d/acme', stores);
    });
    expect(panel()).toBeNull();
  });

  it('keeps the panel closed when the board is opened any other way', async () => {
    await renderFirstRun('/d/acme', storesWithKeys());
    expect(screen.getByRole('heading', { name: 'Acme' })).toBeVisible();
    expect(panel()).toBeNull();
  });
});
