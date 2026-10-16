/**
 * Smoke test for the app shell: each route renders inside the shared
 * header and footer.
 *
 * @module
 */
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { site } from '@/lib/site';

import App from './App';

function renderAt(path: string): void {
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe('App', () => {
  it.each([
    ['/', 'No dashboards yet'],
    ['/spike/amplify', 'Amplify browser spike'],
    ['/spike/github', 'GitHub browser spike'],
  ])('renders %s inside the shell', (path, heading) => {
    renderAt(path);
    expect(screen.getByText(site.name)).toBeInTheDocument();
    expect(screen.getByText(heading)).toBeInTheDocument();
    expect(screen.getByText('Report an issue')).toHaveAttribute(
      'rel',
      'noopener noreferrer',
    );
  });
});
