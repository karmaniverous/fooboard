/**
 * Tests for the Problems panel and its helpers: each problem with where
 * it is, Fix, Customise (when offered) and (for hints) Dismiss, notes
 * apart; marks on rows, stages, cells and the dashboard, groups spread to
 * their members and status sets to the cells using them; and level
 * labels.
 *
 * @module
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DashboardSchema } from '@/domain/config/dashboard';
import { branchRules } from '@/domain/config/placement';
import {
  note,
  type Problem,
  problem,
  type ProblemLevel,
} from '@/domain/problems/problem';
import { cellKey } from '@/engine';

import { levelLabel } from './levelLabel';
import { problemMarks } from './problemMarks';
import { ProblemsPanel } from './ProblemsPanel';

const dashboard = DashboardSchema.parse({
  id: 'd',
  name: 'd',
  stages: [{ id: 'dev', name: 'Dev', rules: branchRules('dev') }],
  rows: [{ type: 'github', id: 'web', repo: 'a/web', displayName: 'Web' }],
  rowGroups: [{ id: 'g', label: 'Front', memberIds: ['web'] }],
  columnGroups: [{ id: 'cg', memberIds: ['dev'] }],
});
const rowHint = problem({ kind: 'row', id: 'web' }, 'read more', true);
const stageProblem = problem({ kind: 'stage', id: 'dev' }, 'no rule');

describe('ProblemsPanel', () => {
  it('lists problems where they are, with Fix and Dismiss for hints', () => {
    const onFix = vi.fn();
    const onDismiss = vi.fn();
    render(
      <ProblemsPanel
        dashboard={dashboard}
        problems={[rowHint, stageProblem]}
        onFix={onFix}
        onDismiss={onDismiss}
      />,
    );
    expect(screen.getByText('Row Web')).toBeInTheDocument();
    expect(screen.getByText('Stage Dev')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Dismiss' })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onDismiss).toHaveBeenCalledWith(rowHint.id);
    fireEvent.click(screen.getAllByRole('button', { name: 'Fix' })[1]);
    expect(onFix).toHaveBeenCalledWith(stageProblem);
  });

  it('offers Customise where asked, and lists notes apart', () => {
    const onCustomise = vi.fn();
    const unchecked = note(
      { kind: 'row', id: 'web' },
      'row rule: unchecked $..x',
    );
    render(
      <ProblemsPanel
        dashboard={dashboard}
        problems={[stageProblem, unchecked]}
        onFix={vi.fn()}
        onDismiss={vi.fn()}
        onCustomise={onCustomise}
        canCustomise={(p) => p === stageProblem}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Customise' }));
    expect(onCustomise).toHaveBeenCalledWith(stageProblem);
    const notes = screen.getByRole('region', { name: 'Notes' });
    expect(
      within(notes).getByText('row rule: unchecked $..x'),
    ).toBeInTheDocument();
    expect(
      within(notes).getByRole('button', { name: 'Dismiss' }),
    ).toBeInTheDocument();
  });

  it('says so when there are none', () => {
    render(
      <ProblemsPanel
        dashboard={dashboard}
        problems={[]}
        onFix={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByText('No problems.')).toBeInTheDocument();
  });
});

describe('problemMarks', () => {
  it('marks rows, stages and cells, spreading groups to their members', () => {
    const marks = problemMarks(dashboard, [
      rowHint,
      problem({ kind: 'rowGroup', id: 'g' }, 'group'),
      problem({ kind: 'columnGroup', id: 'cg' }, 'cols'),
      problem({ kind: 'cell', rowId: 'web', stageId: 'dev' }, 'cell'),
      problem({ kind: 'dashboard' }, 'board'),
      note({ kind: 'row', id: 'web' }, 'unchecked'),
    ]);
    const text = (ps: readonly Problem[] | undefined) =>
      (ps ?? []).map((p) => p.message);
    expect(text(marks.rows.get('web'))).toEqual(['read more', 'group', 'cell']);
    expect(text(marks.stages.get('dev'))).toEqual(['cols']);
    expect(text(marks.cells.get(cellKey('web', 'dev')))).toEqual(['cell']);
    expect(text(marks.dashboard)).toEqual(['board']);
  });

  it('marks the cells using a status set, or the dashboard when none does', () => {
    const marks = problemMarks(dashboard, [
      problem({ kind: 'statusSet', id: 'github-deploy-test' }, 'used'),
      problem({ kind: 'statusSet', id: 'amplify' }, 'unused'),
    ]);
    expect(marks.rows.get('web')?.map((p) => p.message)).toEqual(['used']);
    expect(
      marks.cells.get(cellKey('web', 'dev'))?.map((p) => p.message),
    ).toEqual(['used']);
    expect(marks.dashboard.map((p) => p.message)).toEqual(['unused']);
  });
});

describe('levelLabel', () => {
  it('names every level, falling back to ids', () => {
    expect(
      (
        [
          { kind: 'dashboard' },
          { kind: 'row', id: 'web' },
          { kind: 'stage', id: 'dev' },
          { kind: 'rowGroup', id: 'g' },
          { kind: 'columnGroup', id: 'cg' },
          { kind: 'cell', rowId: 'web', stageId: 'dev' },
          { kind: 'row', id: 'gone' },
          { kind: 'statusSet', id: 'amplify' },
        ] satisfies ProblemLevel[]
      ).map((l) => levelLabel(dashboard, l)),
    ).toEqual([
      'Dashboard',
      'Row Web',
      'Stage Dev',
      'Row group Front',
      'Column group cg',
      'Web / Dev',
      'Row gone',
      'Status set Amplify',
    ]);
  });
});
