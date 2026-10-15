/**
 * Smoke test for the app shell: renders without throwing and shows the
 * header brand and the empty-state home page.
 *
 * @module
 */
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import App from './App';

describe('App', () => {
  it('renders the header brand and the empty-state home page', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByText('fooboard')).toBeInTheDocument();
    expect(screen.getByText('No dashboards yet')).toBeInTheDocument();
  });

  it('renders the Amplify spike page at /spike/amplify', () => {
    render(
      <MemoryRouter initialEntries={['/spike/amplify']}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByText('Amplify browser spike')).toBeInTheDocument();
  });
});
