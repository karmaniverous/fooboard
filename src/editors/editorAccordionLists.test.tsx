/**
 * Tests for the other collapsible lists (spec.md C-21): a source rule's
 * keys, a status set's cell statuses, column groups and Unknown runs
 * each open one item at a time from a keyboard-reachable header, a new
 * item opens, and the editor opened on a fix opens its target (a key
 * inside its source rule; a column group; a row group's settings).
 *
 * @module
 */
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

const render = envRender();

import { DashboardSchema } from '@/domain/config/dashboard';
import { branchRules } from '@/domain/config/placement';
import { RESERVED_KEYS } from '@/domain/model/keys';
import { envRender } from '@/test/envRender';
import { expand, itemTrigger } from '@/test/openItem';

import { DashboardEditor } from './DashboardEditor';
import type { EditorDraft } from './draft';
import { setup, tab } from './editorSectionsHarness';
import { customiseSource } from './sources/customSource';
import { UnknownRunsList } from './statuses/UnknownRunsList';

const isOpen = (name: string) =>
  itemTrigger(name).getAttribute('aria-expanded') === 'true';

const board = customiseSource(
  DashboardSchema.parse({
    id: 'd',
    name: 'Board',
    rows: [{ type: 'github', id: 'api', repo: 'acme/api', displayName: 'api' }],
    rowGroups: [{ id: 'g', label: 'Back', memberIds: ['api'] }],
    stages: [
      { id: 'dev', name: 'dev', rules: branchRules('dev') },
      { id: 'prod', name: 'prod', rules: branchRules('main') },
    ],
    columnGroups: [
      { id: 'pre', label: 'Early', memberIds: ['dev'] },
      { id: 'late', label: 'Late', memberIds: ['prod'] },
    ],
  }),
  'github',
);

const open = (draft: EditorDraft) =>
  render(
    <DashboardEditor
      dashboard={board}
      draft={draft}
      onChange={() => undefined}
    />,
  );

describe('headers', () => {
  it('are buttons, reachable and operable from the keyboard', () => {
    open({ tab: 'Stages', focus: [] });
    const trigger = itemTrigger('dev');
    expect(trigger.tagName).toBe('BUTTON');
    expect(trigger).not.toHaveAttribute('tabindex', '-1');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    // A native button: Enter and Space click it, opening the item and
    // tying the header to its body.
    trigger.focus();
    expect(trigger).toHaveFocus();
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(trigger).toHaveAttribute('aria-controls');
  });
});

describe('the editor opened on a fix', () => {
  it('opens a key inside its source rule, one click from its fields', () => {
    const key = RESERVED_KEYS.branch;
    open({
      tab: 'Sources',
      focus: [`source:github:key:${key}`, 'source:github'],
    });
    expect(isOpen(key)).toBe(true);
    expect(screen.getByLabelText(`${key} translation 1 mode`)).toBeVisible();
  });

  it('opens the column group it targets, with its rules shown', () => {
    open({
      tab: 'Stages',
      focus: ['columnGroup:late:rules', 'columnGroup:late'],
    });
    expect([isOpen('Early'), isOpen('Late')]).toEqual([false, true]);
    expect(
      screen.getByRole('group', { name: 'Stage rules of group Late: GitHub' }),
    ).toBeInTheDocument();
  });

  it("opens a row group's settings in its member's row", () => {
    open({ tab: 'Rows', focus: ['rowGroup:g:record', 'rowGroup:g'] });
    expect(isOpen('api')).toBe(true);
    expect(screen.getByLabelText('GitHub token for Back')).toBeVisible();
  });
});

describe('one open at a time', () => {
  it('opens a stage with its rules shown (one click)', () => {
    open({ tab: 'Stages', focus: [] });
    expand('dev');
    expect(
      screen.getByRole('group', { name: 'Stage rules of dev: GitHub' }),
    ).toBeInTheDocument();
  });

  it('opens one key of a source rule at a time', () => {
    open({ tab: 'Sources', focus: ['source:github'] });
    const [a, b] = board.customSourceRules[0]?.keys.map((k) => k.name) ?? [];
    expand(a);
    expand(b);
    expect([isOpen(a), isOpen(b)]).toEqual([false, true]);
  });

  it('opens one cell status, and a new status opens', () => {
    setup();
    tab('Statuses');
    fireEvent.click(screen.getAllByRole('button', { name: 'Customise' })[1]);
    const set = screen.getByRole('region', { name: /^Status set / });
    const statuses = () =>
      within(set)
        .getAllByRole('region', { name: /^Cell status / })
        .map((r) => r.getAttribute('data-state'));
    expect(statuses().every((s) => s === 'closed')).toBe(true);
    fireEvent.click(within(set).getByRole('button', { name: 'Add status' }));
    expect(statuses().filter((s) => s === 'open')).toHaveLength(1);
    expect(
      within(set).getByRole('region', { name: 'Cell status New status' }),
    ).toHaveAttribute('data-state', 'open');
  });

  it('opens one Unknown run at a time', () => {
    const cell = (stageId: string) => ({
      rowId: 'api',
      rowName: 'api',
      stageId,
      stageName: stageId,
      setName: 'Set',
      document: { stage: stageId },
    });
    render(
      <UnknownRunsList
        unknown={[cell('dev'), cell('prod')]}
        onAddStatus={() => undefined}
      />,
    );
    expand('api · dev');
    expand('api · prod');
    expect([isOpen('api · dev'), isOpen('api · prod')]).toEqual([false, true]);
  });
});
