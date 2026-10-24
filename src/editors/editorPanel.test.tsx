/**
 * Tests for the dashboard editor in its side panel (spec.md §3.6): its
 * tabs sit in the panel's pinned header; opened on a fix, the item it
 * focuses scrolls into view in the panel's body; a keyboard drag past the
 * body's edge scrolls the body, not the panel.
 *
 * @module
 */
import { screen } from '@testing-library/react';
import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SidePanel } from '@/components/SidePanel';
import { Button } from '@/components/ui/button';
import { type Dashboard, DashboardSchema } from '@/domain/config/dashboard';
import { branchRules } from '@/domain/config/placement';
import { createAppStores } from '@/storage';
import { memoryStorage } from '@/storage/keyValue';
import { StoresContext } from '@/storage/storesContext';
import { envRender } from '@/test/envRender';
import { startKeyboardDrag } from '@/test/keyboardDrag';
import {
  applyOverflowUtility,
  scrollContainerOf,
} from '@/test/scrollContainer';

import { DashboardEditor } from './DashboardEditor';
import type { EditorDraft } from './draft';

const render = envRender();

/** Enough rows to overflow the body. */
const ROW_COUNT = 8;
const dashboard = DashboardSchema.parse({
  id: 'd',
  name: 'Board',
  rows: Array.from({ length: ROW_COUNT }, (_, i) => ({
    type: 'github',
    id: `r${String(i)}`,
    repo: `acme/r${String(i)}`,
    displayName: `r${String(i)}`,
  })),
  stages: [{ id: 'dev', name: 'Dev', rules: branchRules('dev') }],
});

function openEditor(draft?: EditorDraft): HTMLElement {
  function Harness(): React.JSX.Element {
    const [d, setD] = useState<Dashboard>(dashboard);
    return (
      <SidePanel open title="Edit dashboard" trigger={<Button>Edit</Button>}>
        <DashboardEditor dashboard={d} draft={draft} onChange={setD} />
      </SidePanel>
    );
  }
  render(
    <StoresContext value={createAppStores(memoryStorage())}>
      <MemoryRouter>
        <Harness />
      </MemoryRouter>
    </StoresContext>,
  );
  return screen.getByRole('dialog', { name: 'Edit dashboard' });
}

/** The panel's body: what scrolls the editor's sections. */
const bodyOf = () => scrollContainerOf(screen.getByRole('tabpanel'));

let restore: () => void;
beforeEach(() => {
  restore = applyOverflowUtility();
});
afterEach(() => {
  restore();
  vi.restoreAllMocks();
});

describe('the dashboard editor in its side panel', () => {
  it('shows its tabs in the pinned header, focused on open', () => {
    const dialog = openEditor();
    const body = bodyOf();
    expect(dialog).toContainElement(body);
    const tabs = screen.getByRole('tablist', { name: 'Editor section' });
    expect(body).not.toContainElement(tabs);
    expect(screen.getByRole('tab', { name: 'General' })).toHaveFocus();
  });

  it("scrolls a fix's item into view inside the body", () => {
    const scrolled = vi.spyOn(Element.prototype, 'scrollIntoView');
    openEditor({ tab: 'Rows', focus: ['row:r6'] });
    const item = document.querySelector('[data-edit-target="row:r6"]');
    expect(scrolled.mock.contexts).toEqual([item]);
    const body = bodyOf();
    expect(body).toContainElement(item instanceof HTMLElement ? item : null);
    expect(body).not.toContainElement(
      screen.getByRole('heading', { name: 'Edit dashboard' }),
    );
  });

  it('scrolls the body when a keyboard drag passes its edge', async () => {
    openEditor({ tab: 'Rows', focus: [] });
    const body = bodyOf();
    if (!body) throw new Error('no panel body');
    expect(body).not.toContainElement(
      screen.getByRole('heading', { name: 'Edit dashboard' }),
    );
    // The body shows 200 px of 2000 (jsdom doesn't lay out).
    const VIEW = 200;
    Object.defineProperties(body, {
      clientHeight: { value: VIEW },
      scrollHeight: { value: VIEW * 10 },
      getBoundingClientRect: {
        value: () => new DOMRect(0, 0, VIEW, VIEW),
      },
    });
    const scrollTo = vi.fn();
    body.scrollTo = scrollTo;
    const drag = await startKeyboardDrag(
      screen.getByRole('button', { name: 'Drag r3 to reorder' }),
    );
    await drag.move('down');
    await drag.drop();
    const [[options]] = scrollTo.mock.calls;
    expect(options).toMatchObject({ top: 48 });
  });
});
