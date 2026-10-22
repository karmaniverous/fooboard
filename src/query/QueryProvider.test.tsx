/**
 * Tests for the query provider (spec.md §3.1): components below it read
 * the environment it was given, and the Devtools never render in tests
 * (development builds only; the production build check keeps them out of
 * the bundle).
 *
 * @module
 */
import { useQueryClient } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

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

  it('refuses a consumer outside any provider', () => {
    expect(() => render(<Probe env={undefined} />)).toThrow(
      'useQueryEnv needs a QueryProvider',
    );
  });
});
