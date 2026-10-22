/**
 * Regression tests from review of the collapsible lists (spec.md C-21):
 * a fix on a row group opens its settings in a row already open; a
 * source rule's keys keep which one is open when another is deleted;
 * *Add status* on a run no status matches opens the new status and its
 * set, for a set already owned and for a preset it copies.
 *
 * @module
 */
import { fireEvent, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

const render = envRender();

import { type Dashboard, DashboardSchema } from '@/domain/config/dashboard';
import { branchRules } from '@/domain/config/placement';
import type { KeyDef } from '@/domain/model/sourceRule';
import { envRender } from '@/test/envRender';
import { expand, itemTrigger } from '@/test/openItem';

import { DashboardEditor } from './DashboardEditor';
import type { EditorDraft } from './draft';
import { KeysEditor } from './sources/KeysEditor';
import { customise } from './statuses/customSet';
import { StatusSetsEditor } from './statuses/StatusSetsEditor';

const isOpen = (name: string) =>
  itemTrigger(name).getAttribute('aria-expanded') === 'true';

const board = DashboardSchema.parse({
  id: 'd',
  name: 'Board',
  credentials: [{ id: 'gh', kind: 'github', label: 'team' }],
  rows: [{ type: 'github', id: 'api', repo: 'acme/api', displayName: 'api' }],
  rowGroups: [{ id: 'g', label: 'Back', memberIds: ['api'] }],
  stages: [{ id: 'dev', name: 'dev', rules: branchRules('dev') }],
});

describe('a fix on a row group', () => {
  it('opens its settings in a member row already open', () => {
    const view = (draft: EditorDraft) => (
      <DashboardEditor
        dashboard={board}
        draft={draft}
        onChange={() => undefined}
      />
    );
    const { rerender } = render(view({ tab: 'Rows', focus: [] }));
    expand('api');
    const settings = screen.getByRole('button', { name: /^Group settings/ });
    expect(settings).toHaveAttribute('aria-expanded', 'false');
    rerender(view({ tab: 'Rows', focus: ['rowGroup:g:record', 'rowGroup:g'] }));
    expect(settings).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByLabelText('GitHub token for Back')).toBeVisible();
  });
});

describe("a source rule's keys", () => {
  const key = (name: string): KeyDef => ({ name, translations: [] });
  function Harness(): React.JSX.Element {
    const [keys, setKeys] = useState([key('a'), key('b'), key('c')]);
    return <KeysEditor title="Record keys" keys={keys} onChange={setKeys} />;
  }
  const remove = (name: string) => {
    fireEvent.click(screen.getByRole('button', { name: `Delete key ${name}` }));
  };

  it('keep the open key open when one before it is deleted', () => {
    render(<Harness />);
    expand('b');
    remove('a');
    expect([isOpen('b'), isOpen('c')]).toEqual([true, false]);
  });

  it('keep a closed key closed when one before it is deleted', () => {
    render(<Harness />);
    expand('c');
    remove('a');
    expect([isOpen('b'), isOpen('c')]).toEqual([false, true]);
  });
});

describe('Add status on a run no status matches', () => {
  const run = { workflow: 'Release', items: [{ state: 'success' }] };
  const unknown = [
    {
      rowId: 'api',
      rowName: 'api',
      stageId: 'dev',
      stageName: 'dev',
      setName: 'Set',
      document: run,
    },
  ];
  function Harness({ start }: { start: Dashboard }): React.JSX.Element {
    const [d, setD] = useState(start);
    return <StatusSetsEditor dashboard={d} onChange={setD} unknown={unknown} />;
  }
  const addStatus = () => {
    fireEvent.click(
      screen.getByRole('button', { name: 'Add status for api dev' }),
    );
  };
  const newStatusIn = (set: HTMLElement) =>
    within(set).getByRole('region', { name: 'Cell status New status' });

  it('opens the new status in a set already owned and closed', () => {
    render(<Harness start={customise(board, board.statusSets.github)} />);
    const set = screen.getByRole('region', { name: /^Status set / });
    expect(set).toHaveAttribute('data-state', 'closed');
    addStatus();
    expect(set).toHaveAttribute('data-state', 'open');
    expect(newStatusIn(set)).toHaveAttribute('data-state', 'open');
  });

  it('opens the new status in the set it copies from a preset', () => {
    render(<Harness start={board} />);
    addStatus();
    const set = screen.getByRole('region', { name: /^Status set / });
    expect(set).toHaveAttribute('data-state', 'open');
    expect(newStatusIn(set)).toHaveAttribute('data-state', 'open');
  });
});
