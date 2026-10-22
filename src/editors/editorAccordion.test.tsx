/**
 * Tests for collapsible editor lists (spec.md C-21): items start closed,
 * at most one is open, a newly added item opens and scrolls into view,
 * and the editor opened on a fix opens the item it targets.
 *
 * @module
 */
import { fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const render = envRender();

import { DashboardSchema } from '@/domain/config/dashboard';
import { branchRules } from '@/domain/config/placement';
import { envRender } from '@/test/envRender';
import { expand, isOpen, itemTrigger } from '@/test/openItem';

import { DashboardEditor } from './DashboardEditor';
import type { EditorDraft } from './draft';
import { setup, tab } from './editorSectionsHarness';

// jsdom doesn't lay out, so has no scrollIntoView; a test may stub one.
afterEach(() => {
  Reflect.deleteProperty(Element.prototype, 'scrollIntoView');
});

describe('collapsible rows', () => {
  it('starts with every row closed and opens one at a time', () => {
    setup();
    tab('Rows');
    expect([isOpen('api'), isOpen('web')]).toEqual([false, false]);
    expect(screen.queryByLabelText('Display name for acme/api')).toBeNull();
    expand('api');
    expect(screen.getByLabelText('Display name for acme/api')).toBeVisible();
    expand('web');
    expect([isOpen('api'), isOpen('web')]).toEqual([false, true]);
    expect(screen.queryByLabelText('Display name for acme/api')).toBeNull();
    fireEvent.click(itemTrigger('web'));
    expect(isOpen('web')).toBe(false);
  });

  it('opens a newly added row and scrolls it into view', async () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    setup();
    tab('Rows');
    expand('api');
    fireEvent.click(screen.getByRole('button', { name: 'List Amplify apps' }));
    fireEvent.click(await screen.findByRole('button', { name: /^site/ }));
    // (The picker's own `site` button shares the name: find it by key.)
    const site = document.querySelector('[data-edit-target="row:site"]');
    expect(isOpen('api')).toBe(false);
    expect(site).toHaveAttribute('data-state', 'open');
    expect(scroll).toHaveBeenCalledOnce();
    expect(scroll.mock.contexts[0]).toBe(site);
  });
});

describe('the editor opened on a fix', () => {
  const dashboard = DashboardSchema.parse({
    id: 'd',
    name: 'Board',
    rows: [
      { type: 'github', id: 'api', repo: 'acme/api', displayName: 'api' },
      { type: 'github', id: 'web', repo: 'acme/web', displayName: 'web' },
    ],
    stages: [
      { id: 'dev', name: 'dev', rules: branchRules('dev') },
      { id: 'prod', name: 'prod', rules: branchRules('main') },
    ],
  });
  const open = (draft: EditorDraft) =>
    render(
      <DashboardEditor
        dashboard={dashboard}
        draft={draft}
        onChange={() => undefined}
      />,
    );

  it('opens the row it targets, and only that row', () => {
    open({ tab: 'Rows', focus: ['row:web:record', 'row:web'] });
    expect([isOpen('api'), isOpen('web')]).toEqual([false, true]);
    expect(
      screen.getByRole('group', { name: 'Record rule for web' }),
    ).toBeInTheDocument();
  });

  it('opens the stage it targets', () => {
    open({ tab: 'Stages', focus: ['stage:prod:rules', 'stage:prod'] });
    expect([isOpen('dev'), isOpen('prod')]).toEqual([false, true]);
  });

  it('opens the row it targets when the fix comes while the tab is open', () => {
    const { rerender } = open({ tab: 'Rows', focus: [] });
    expect(isOpen('web')).toBe(false);
    rerender(
      <DashboardEditor
        dashboard={dashboard}
        draft={{ tab: 'Rows', focus: ['row:web'] }}
        onChange={() => undefined}
      />,
    );
    expect(isOpen('web')).toBe(true);
  });
});

describe('collapsible status sets and source rules', () => {
  it('opens a customised status set, closing the one open', () => {
    setup();
    tab('Statuses');
    fireEvent.click(screen.getAllByRole('button', { name: 'Customise' })[0]);
    const first = screen.getByRole('region', { name: /^Status set / });
    expect(first).toHaveAttribute('data-state', 'open');
    fireEvent.click(screen.getAllByRole('button', { name: 'Customise' })[1]);
    const states = screen
      .getAllByRole('region', { name: /^Status set / })
      .map((r) => r.getAttribute('data-state'));
    expect(states).toEqual(['closed', 'open']);
  });

  it('opens a customised source rule', () => {
    setup();
    tab('Sources');
    fireEvent.click(screen.getAllByRole('button', { name: 'Customise' })[0]);
    expect(
      screen.getByRole('region', { name: /^Source rule / }),
    ).toHaveAttribute('data-state', 'open');
  });
});
