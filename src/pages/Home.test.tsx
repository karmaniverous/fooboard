/**
 * Tests for the home page: the empty app offers the four ways in
 * (spec.md §3.9 *First run*; spec 0.2.0 §3.J): *Create a dashboard*
 * opening the first run, *Import from link or file* opening the import
 * dialog, *Set up with an AI assistant* opening its dialog, and *Try the
 * demo*; saved dashboards are listed; unreadable configuration offers no
 * *Create*, *Import* or *Set up with an AI assistant* (none could be
 * saved), but *Reset*.
 *
 * @module
 */
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createDashboard } from '@/domain/config/presets';
import { createAppStores } from '@/storage';
import { type KeyValueStore, memoryStorage } from '@/storage/keyValue';
import { renderShell } from '@/test/renderShell';
import { RouterProbe } from '@/test/RouterProbe';

import { Home } from './Home';

const renderHome = (store: KeyValueStore = memoryStorage()) =>
  renderShell(
    <>
      <Home />
      <RouterProbe />
    </>,
    undefined,
    createAppStores(store),
  );

describe('Home', () => {
  it('offers creating a dashboard, importing one and the demo on the empty app', () => {
    renderHome();
    expect(
      screen.getByRole('heading', { name: 'No dashboards yet' }),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: 'Try the demo' })).toHaveAttribute(
      'href',
      '/demo',
    );
    fireEvent.click(screen.getByRole('link', { name: 'Create a dashboard' }));
    expect(screen.getByTestId('where')).toHaveTextContent('/new');
  });

  it('opens the import dialog, for a file or a link', () => {
    renderHome();
    fireEvent.click(
      screen.getByRole('button', { name: 'Import from link or file…' }),
    );
    expect(
      screen.getByRole('dialog', { name: 'Import dashboards' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('A fooboard file')).toBeInTheDocument();
    expect(
      screen.getByLabelText('Or a fooboard link, or its JSON'),
    ).toBeInTheDocument();
  });

  it('opens Set up with an AI assistant, after Import from link or file', () => {
    renderHome();
    expect(
      screen.getByText(
        /Create a dashboard, import one from a link or file, set one up with your AI assistant, or try the demo/,
      ),
    ).toBeVisible();
    const buttons = screen.getAllByRole('button').map((b) => b.textContent);
    expect(buttons.indexOf('Set up with an AI assistant…')).toBe(
      buttons.indexOf('Import from link or file…') + 1,
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Set up with an AI assistant…' }),
    );
    expect(
      screen.getByRole('dialog', { name: 'Set up with an AI assistant' }),
    ).toBeInTheDocument();
  });

  it('lists saved dashboards above the same four ways in', () => {
    const stores = createAppStores(memoryStorage());
    stores.config.saveDashboard(createDashboard('Acme', 'env-branches'));
    renderShell(<Home />, undefined, stores);
    expect(
      screen.getByRole('heading', { name: 'Your dashboards' }),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: /^Acme/ })).toHaveTextContent(
      'Acme0 rows × 3 stages',
    );
    expect(
      screen.getByRole('link', { name: 'Create a dashboard' }),
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Set up with an AI assistant…' }),
    ).toBeVisible();
  });
});

describe('Home storage failures', () => {
  it('offers no Create or Import, but Reset, when the saved configuration is unreadable', () => {
    const store = memoryStorage();
    store.setItem('fooboard:config', '{not json');
    renderHome(store);
    expect(
      screen.queryByRole('link', { name: 'Create a dashboard' }),
    ).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Import from link or file…' }),
    ).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Set up with an AI assistant…' }),
    ).toBeNull();
    expect(screen.getByRole('link', { name: 'Try the demo' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Reset…' }));
    expect(
      screen.getByRole('alertdialog', { name: 'Reset fooboard?' }),
    ).toBeInTheDocument();
  });
});
