/**
 * Tests for the home page: it offers only what is built (no import yet);
 * unreadable configuration offers no *Create* (it couldn't be saved), and
 * a refused write when creating is reported with the name kept for retry.
 *
 * @module
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { createAppStores } from '@/storage';
import { type KeyValueStore, memoryStorage } from '@/storage/keyValue';
import { StoresContext } from '@/storage/storesContext';

import { Home } from './Home';

const renderHome = (store: KeyValueStore) => {
  render(
    <StoresContext value={createAppStores(store)}>
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    </StoresContext>,
  );
};

describe('Home', () => {
  it('invites creating a dashboard, and not importing one', () => {
    renderHome(memoryStorage());
    expect(
      screen.getByText(/Create a dashboard to get started\./),
    ).toBeVisible();
    expect(screen.queryByText(/import/i)).toBeNull();
  });
});

describe('Home storage failures', () => {
  it('offers no Create when the saved configuration is unreadable', () => {
    const store = memoryStorage();
    store.setItem('fooboard:config', '{not json');
    renderHome(store);
    expect(
      screen.queryByRole('button', { name: 'Create a dashboard' }),
    ).toBeNull();
  });

  it('reports a refused write and keeps the name', () => {
    const store = memoryStorage();
    renderHome({
      ...store,
      setItem: () => {
        throw new Error('storage refused the write');
      },
    });
    fireEvent.change(screen.getByLabelText('Dashboard name'), {
      target: { value: 'Acme' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create a dashboard' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'storage refused the write',
    );
    expect(screen.getByLabelText('Dashboard name')).toHaveValue('Acme');
  });
});
