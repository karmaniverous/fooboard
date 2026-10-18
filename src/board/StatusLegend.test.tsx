/**
 * Tests for the legend: it lists each set the board's cells use, once,
 * with its statuses, and Unknown.
 *
 * @module
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DashboardSchema } from '@/domain/config/dashboard';

import { legendSets } from './legendSets';
import { StatusLegend } from './StatusLegend';

const dashboard = DashboardSchema.parse({
  id: 'd',
  name: 'D',
  stages: [
    { id: 'dev', name: 'Dev', branchPattern: 'dev' },
    { id: 'prod', name: 'Prod', branchPattern: 'main' },
  ],
  rows: [
    { type: 'github', id: 'a', repo: 'acme/a', displayName: 'a' },
    {
      type: 'github',
      id: 'b',
      repo: 'acme/b',
      displayName: 'b',
      cellStatusSets: { prod: 'github-single-job' },
    },
  ],
});

describe('StatusLegend', () => {
  it('lists the sets in use once each, in board order', () => {
    expect(legendSets(dashboard).map((s) => s.id)).toEqual([
      'github-deploy-test',
      'github-single-job',
    ]);
  });

  it('shows each set with its statuses, then Unknown', () => {
    render(<StatusLegend dashboard={dashboard} />);
    fireEvent.click(screen.getByRole('button', { name: 'Legend' }));
    const set = screen.getByRole('region', { name: 'GitHub deploy and test' });
    expect(within(set).getByText('Tests failed')).toBeInTheDocument();
    expect(within(set).getAllByRole('listitem')).toHaveLength(9);
    expect(
      screen.getByRole('region', { name: 'GitHub single job' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Amplify' })).toBeNull();
    expect(
      within(screen.getByRole('list', { name: 'No match' })).getByRole(
        'listitem',
      ),
    ).toHaveTextContent('Unknown');
  });
});
