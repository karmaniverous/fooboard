/**
 * Tests for the query provider (spec.md §3.1): components below it read
 * the environment it was given; the Devtools load lazily in development
 * and never render in tests (the production build check keeps them out
 * of the bundle).
 *
 * @module
 */
import { useQueryClient } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { testQueryEnv } from '@/test/queryEnv';

import { useQueryEnv } from './queryEnvContext';
import { QueryProvider } from './QueryProvider';

function Probe({ env }: { env: unknown }): React.JSX.Element {
  const ours = useQueryEnv();
  const client = useQueryClient();
  return (
    <output>
      {String(ours === env)} {String(client === ours.client)}
    </output>
  );
}

describe('QueryProvider', () => {
  it('provides its environment and that environment’s client', () => {
    const env = testQueryEnv();
    render(
      <QueryProvider env={env}>
        <Probe env={env} />
      </QueryProvider>,
    );
    expect(screen.getByRole('status')).toHaveTextContent('true true');
  });

  it('renders no Devtools outside development', () => {
    const { container } = render(
      <QueryProvider env={testQueryEnv()}>
        <p>board</p>
      </QueryProvider>,
    );
    expect(container.innerHTML).toBe('<p>board</p>');
    expect(document.querySelector('.tsqd-parent-container')).toBeNull();
  });

  it('loads the Devtools lazily in development', async () => {
    vi.stubEnv('DEV', true);
    vi.stubEnv('MODE', 'development');
    vi.resetModules();
    // The real Devtools render nothing unless NODE_ENV is development.
    vi.doMock('@tanstack/react-query-devtools', () => ({
      ReactQueryDevtools: () => <aside>devtools</aside>,
    }));
    try {
      const { QueryProvider: DevProvider } = await import('./QueryProvider');
      render(
        <DevProvider env={testQueryEnv()}>
          <p>board</p>
        </DevProvider>,
      );
      expect(screen.getByText('board')).toBeInTheDocument();
      expect(await screen.findByText('devtools')).toBeInTheDocument();
    } finally {
      vi.doUnmock('@tanstack/react-query-devtools');
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });

  it('refuses a consumer outside any provider', () => {
    expect(() => render(<Probe env={undefined} />)).toThrow(
      'useQueryEnv needs a QueryProvider',
    );
  });
});
