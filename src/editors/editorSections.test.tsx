/**
 * Tests for the editor sections the main editor tests don't reach:
 * Amplify rows from `ListApps` (apps without a GitHub repo can't be
 * added), repo-list failures, labelled column groups, drag reordering,
 * mapping rules and colours.
 *
 * @module
 */
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PRESET_IDS } from '@/domain/config/statusSets';
import { choose } from '@/test/choose';
import { keyboardDrag } from '@/test/keyboardDrag';
import { expand } from '@/test/openItem';

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
    expand('prod');
    choose(screen.getByLabelText('Group of prod'), 'New group from prod');
    const label = screen.getByLabelText('Label of the group of prod');
    fireEvent.change(label, { target: { value: 'Production' } });
    fireEvent.blur(label);
    expect(latest.current.columnGroups).toEqual([
      {
        id: 'group-prod',
        label: 'Production',
        memberIds: ['prod'],
        stageRules: {},
      },
    ]);
  });

  it('reorders by dragging an item onto another', async () => {
    const latest = setup();
    tab('Stages');
    await keyboardDrag(
      screen.getByRole('button', { name: 'Drag dev to reorder' }),
      1,
    );
    expect(latest.current.stages.map((s) => s.id)).toEqual(['prod', 'dev']);
  });

  it('customises a source rule and edits what it reads, and the status sets', () => {
    const latest = setup();
    tab('Sources');
    fireEvent.click(screen.getAllByRole('button', { name: 'Customise' })[0]);
    expect(latest.current.sourceRules.github).toBe('custom-github');
    const runs = screen.getByLabelText('Runs per repo');
    fireEvent.change(runs, { target: { value: '250' } });
    fireEvent.blur(runs);
    expect(latest.current.customSourceRules[0]).toMatchObject({
      provider: 'github',
      reader: { runs: 250 },
    });
    expect(
      screen.getByText('3 requests per repo per poll'),
    ).toBeInTheDocument();

    tab('Statuses');
    choose(screen.getByLabelText('GitHub status set'), 'GitHub single job');
    expect(latest.current.statusSets.github).toBe(PRESET_IDS.githubSingleJob);
  });
});
