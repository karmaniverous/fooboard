/**
 * Tests for the Problems panel and its helpers: each problem with where
 * it is, Fix and (for hints) Dismiss; marks on rows and stages, groups
 * spread to their members; and the editor tab each problem opens.
 *
 * @module
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DashboardSchema } from '@/domain/config/dashboard';
import { branchRules } from '@/domain/config/placement';
import { problem } from '@/domain/problems/problems';
import { problemDraft } from '@/editors/draft';

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
  it('marks rows and stages, spreading groups to their members', () => {
    const marks = problemMarks(dashboard, [
      rowHint,
      problem({ kind: 'rowGroup', id: 'g' }, 'group'),
      problem({ kind: 'columnGroup', id: 'cg' }, 'cols'),
      problem({ kind: 'cell', rowId: 'web', stageId: 'dev' }, 'cell'),
      problem({ kind: 'dashboard' }, 'board'),
    ]);
    expect(marks.rows.get('web')).toEqual(['read more', 'group', 'cell']);
    expect(marks.stages.get('dev')).toEqual(['cols']);
  });
});

describe('problemDraft', () => {
  it('opens the tab that fixes it', () => {
    expect(problemDraft(rowHint)).toEqual({ tab: 'Rows', rowId: 'web' });
    expect(problemDraft(stageProblem)).toEqual({ tab: 'Stages' });
    expect(
      problemDraft(problem({ kind: 'dashboard' }, 'GitHub source rule: x')),
    ).toEqual({ tab: 'Sources' });
    expect(
      problemDraft(
        problem({ kind: 'row', id: 'web' }, 'row rule: GitHub gives no key x'),
      ),
    ).toEqual({ tab: 'Sources' });
  });
});
