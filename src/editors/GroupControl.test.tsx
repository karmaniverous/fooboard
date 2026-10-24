/**
 * Tests for the group control (spec.md C-14b, §3.11): leaving a group as
 * its last member warns that the group's settings go with it, on both
 * axes, and only when the group carries something.
 *
 * @module
 */
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DashboardSchema } from '@/domain/config/dashboard';
import { envRender } from '@/test/envRender';

import { GroupControl } from './GroupControl';

const board = (columnSettings: Record<string, unknown>) =>
  DashboardSchema.parse({
    id: 'd',
    name: 'D',
    credentials: [{ id: 'k', kind: 'aws', label: 'k' }],
    rows: [{ type: 'github', id: 'api', repo: 'acme/api', displayName: 'api' }],
    stages: [
      { id: 'dev', name: 'Dev' },
      { id: 'prod', name: 'Prod' },
    ],
    rowGroups: [{ id: 'rg', memberIds: ['api'], settings: { awsKey: 'k' } }],
    columnGroups: [{ id: 'cg', memberIds: ['prod'], settings: columnSettings }],
  });

const renderControl = (
  axis: 'rows' | 'stages',
  itemId: string,
  columnSettings: Record<string, unknown> = { awsKey: 'k' },
) => {
  envRender()(
    <GroupControl
      dashboard={board(columnSettings)}
      axis={axis}
      itemId={itemId}
      name={itemId}
      onChange={() => undefined}
    />,
  );
};

describe('leaving a group as its last member', () => {
  it.each<['rows' | 'stages', string, string]>([
    ['rows', 'api', 'row'],
    ['stages', 'prod', 'stage'],
  ])('warns on the %s axis that its settings go', (axis, itemId, noun) => {
    renderControl(axis, itemId);
    expect(
      screen.getByText(
        `Moving this ${noun} out deletes its group and the group's settings and overrides.`,
      ),
    ).toBeInTheDocument();
  });

  it('says nothing when the group carries nothing', () => {
    renderControl('stages', 'prod', {});
    expect(screen.queryByText(/Moving this stage out/)).toBeNull();
  });
});
