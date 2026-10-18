/**
 * Tests for the editor sections the main editor tests don't reach:
 * Amplify rows from `ListApps` (apps without a GitHub repo can't be
 * added), repo-list failures, labelled column groups, drag reordering,
 * mapping rules and colours.
 *
 * @module
 */
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DEFAULT_STATUS_COLORS } from '@/domain/config/colors';
import { choose } from '@/test/choose';

import { setup, tab } from './editorSectionsHarness';

describe('editor sections', () => {
  it('adds an Amplify row from ListApps, refusing apps without a GitHub repo', async () => {
    const latest = setup();
    tab('Rows');
    fireEvent.click(screen.getByRole('button', { name: 'List Amplify apps' }));
    const orphan = await screen.findByRole('button', { name: /orphan/ });
    expect(orphan).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /site/ }));
    expect(latest.current.rows.at(-1)).toMatchObject({
      type: 'amplify',
      repo: 'acme/site',
      displayName: 'site',
      sources: [{ region: 'us-east-1', appId: 'a1' }],
    });
  });

  it('reports a repo list that fails to load', async () => {
    setup({ listRepos: () => Promise.reject(new Error('Bad credentials')) });
    tab('Rows');
    fireEvent.click(screen.getByRole('button', { name: 'Add a GitHub row' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Bad credentials',
    );
  });

  it('creates a labelled column group from a stage', () => {
    const latest = setup();
    tab('Stages');
    choose(screen.getByLabelText('Group of prod'), 'New group from prod');
    const label = screen.getByLabelText('Label of the group of prod');
    fireEvent.change(label, { target: { value: 'Production' } });
    fireEvent.blur(label);
    expect(latest.current.columnGroups).toEqual([
      { id: 'group-prod', label: 'Production', memberIds: ['prod'] },
    ]);
  });

  it('reorders by dragging an item onto another', () => {
    const latest = setup();
    tab('Stages');
    const items = screen.getAllByRole('listitem');
    const grip = items[0]?.querySelector('[draggable]');
    if (!grip || !items[1]) throw new Error('drag handles not found');
    fireEvent.dragStart(grip, { dataTransfer: { effectAllowed: '' } });
    fireEvent.dragOver(items[1]);
    fireEvent.drop(items[1]);
    expect(latest.current.stages.map((s) => s.id)).toEqual(['prod', 'dev']);
  });

  it('edits mapping rules and colours', () => {
    const latest = setup();
    tab('Mapping');
    fireEvent.change(screen.getByLabelText('New Deploy phase tests value'), {
      target: { value: 'deploy' },
    });
    const deploy = screen.getByRole('group', { name: 'Deploy phase tests' });
    fireEvent.click(within(deploy).getByRole('button', { name: 'Add' }));
    expect(latest.current.mapping.phases.deploy.at(-1)).toEqual({
      field: 'jobName',
      operator: 'contains',
      value: 'deploy',
    });

    tab('Colours');
    fireEvent.change(screen.getByLabelText('Failure colour'), {
      target: { value: '#123456' },
    });
    expect(latest.current.statusColors.failure).toBe('#123456');
    fireEvent.click(screen.getByRole('button', { name: 'Reset colours' }));
    expect(latest.current.statusColors).toEqual(DEFAULT_STATUS_COLORS);
  });
});
