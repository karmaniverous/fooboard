/**
 * Tests for the legend: it lists each set the board's cells use, once,
 * with its statuses, and Unknown.
 *
 * @module
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DashboardSchema } from '@/domain/config/dashboard';
import { branchRules } from '@/domain/config/placement';
import { PRESET_IDS } from '@/domain/config/statusSets';

import { legendSets } from './legendSets';
import { StatusLegend } from './StatusLegend';

const dashboard = DashboardSchema.parse({
  id: 'd',
  name: 'D',
  stages: [
    { id: 'dev', name: 'Dev', rules: branchRules('dev') },
    { id: 'prod', name: 'Prod', rules: branchRules('main') },
  ],
  rows: [
    { type: 'github', id: 'a', repo: 'acme/a', displayName: 'a' },
    {
      type: 'github',
      id: 'b',
      repo: 'acme/b',
      displayName: 'b',
      cellSettings: {
        prod: { statusSets: { github: PRESET_IDS.githubSingleJob } },
      },
    },
  ],
});

describe('StatusLegend', () => {
  it('lists the sets in use once each, in board order', () => {
    expect(legendSets(dashboard).map((s) => s.id)).toEqual([
      PRESET_IDS.githubDeployTest,
      PRESET_IDS.githubSingleJob,
    ]);
  });

  it('shows each set with its statuses, then Unknown', () => {
    render(<StatusLegend dashboard={dashboard} />);
    fireEvent.click(screen.getByRole('button', { name: 'Legend' }));
    const set = screen.getByRole('region', { name: 'GitHub deploy and test' });
    expect(within(set).getByText('Tests failed')).toBeInTheDocument();
    expect(within(set).getAllByRole('listitem')).toHaveLength(9);
    // Outlined statuses are outlined here too.
    expect(within(set).getByText('Queued').closest('li')).toHaveClass(
      'border-dashed',
    );
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
