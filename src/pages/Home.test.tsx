/**
 * Tests for the home page: it offers only what is built (no import yet);
 * unreadable configuration offers no *Create* (it couldn't be saved), and
 * a refused write when creating is reported with the name kept for retry.
 *
 * @module
 */
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createAppStores } from '@/storage';
import { type KeyValueStore, memoryStorage } from '@/storage/keyValue';
import { renderShell } from '@/test/renderShell';

import { Home } from './Home';

const renderHome = (store: KeyValueStore) => {
  renderShell(<Home />, undefined, createAppStores(store));
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
  it('offers no Create, but Reset, when the saved configuration is unreadable', () => {
    const store = memoryStorage();
    store.setItem('fooboard:config', '{not json');
    renderHome(store);
    expect(
      screen.queryByRole('button', { name: 'Create a dashboard' }),
    ).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Reset…' }));
    expect(
      screen.getByRole('alertdialog', { name: 'Reset fooboard?' }),
    ).toBeInTheDocument();
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
