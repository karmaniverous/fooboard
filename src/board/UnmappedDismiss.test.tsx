/**
 * Dismissing unmapped runs from the panel (spec 0.2.0 §3.I, Decisions 86
 * and 101): the inline *Dismiss…* form's presets fill its fields; each
 * field can be cleared; *Dismiss* is disabled, saying why, while none is
 * set; the form counts the entries its pattern matches; *Dismiss* saves
 * the pattern, hides what it matches and returns focus to the heading,
 * or to the board's title when no entry is left; Escape cancels to the
 * *Dismiss…* button without closing the panel; one form is open at a
 * time; *Show dismissed* lists the dismissed entries with the pattern
 * hiding each, and *Undo* removes it; a refused save says *Not saved*.
 *
 * @module
 */
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { Unlink } from 'lucide-react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { SidePanel } from '@/components/SidePanel';
import { type Dashboard, DashboardSchema } from '@/domain/config/dashboard';
import { UNMAPPED } from '@/domain/derivation';
import type { UnmappedRun } from '@/engine';
import { splitUnmapped } from '@/engine/unmappedDismissals';
import { choose } from '@/test/choose';

import { BoardActionButton } from './BoardActionButton';
import { BOARD_TITLE_ID } from './BoardScreen';
import { UnmappedPanel } from './UnmappedPanel';

const noRow = { kind: UNMAPPED.noRowMatches } as const;
const entry = (n: number, over: Partial<UnmappedRun> = {}): UnmappedRun => ({
  provider: 'github',
  id: `github:acme/api#${String(n)}`,
  where: 'acme/api',
  title: 'Deploy API',
  record: {},
  branch: 'feature/login',
  htmlUrl: `https://github.com/acme/api/actions/runs/${String(n)}`,
  reason: noRow,
  rows: [{ rowId: 'api', reason: noRow }],
  ...over,
});
const deploy = entry(1);
const nightly = entry(2, { title: 'Nightly', branch: 'main' });

const PANEL = 'Unmapped runs';

/** The panel in its side panel, open, over a dashboard kept in state;
 * the panel goes, as its button does, once no entry is shown. */
function renderPanel(
  unmapped: UnmappedRun[] = [deploy, nightly],
  save: (d: Dashboard) => void = () => undefined,
) {
  const saved: Dashboard[] = [];
  function Harness(): React.JSX.Element {
    const [dashboard, setDashboard] = useState(
      DashboardSchema.parse({ id: 'd', name: 'D' }),
    );
    const [show, setShow] = useState(false);
    const shown = splitUnmapped(unmapped, dashboard.unmappedDismissals).shown;
    return (
      <>
        <h1 id={BOARD_TITLE_ID} tabIndex={-1}>
          Board
        </h1>
        {shown.length > 0 && (
          <SidePanel
            title={PANEL}
            tooltip={PANEL}
            trigger={<BoardActionButton label={PANEL} Icon={Unlink} />}
          >
            <UnmappedPanel
              unmapped={unmapped}
              dashboard={dashboard}
              onChange={(next) => {
                save(next);
                saved.push(next);
                setDashboard(next);
              }}
              showDismissed={show}
              onShowDismissed={setShow}
              onAddTest={() => undefined}
            />
          </SidePanel>
        )}
      </>
    );
  }
  render(<Harness />);
  fireEvent.click(screen.getByRole('button', { name: PANEL }));
  return saved;
}

const panel = () => screen.getByRole('dialog', { name: PANEL });
const openForm = (title: string) => {
  const item = within(panel()).getByRole('link', { name: title }).closest('li');
  if (!item) throw new Error(`no entry ${title}`);
  fireEvent.click(within(item).getByRole('button', { name: 'Dismiss…' }));
  return screen.getByRole('form', { name: `Dismiss ${title}` });
};
const field = (form: HTMLElement, name: string) =>
  within(form).getByRole('textbox', { name });
const dismissButton = (form: HTMLElement) =>
  within(form).getByRole('button', { name: 'Dismiss' });
const heading = () => within(panel()).getByRole('heading', { level: 3 });

describe('dismissing an unmapped run', () => {
  it('fills the fields from the chosen preset, focus on the preset choice', () => {
    renderPanel();
    const form = openForm('Deploy API');
    const presets = within(form).getAllByRole('radio');
    expect(presets.map((p) => p.getAttribute('value'))).toEqual([
      'workflow',
      'branchHere',
      'branchesLike',
      'reason',
    ]);
    expect(document.activeElement).toBe(presets[0]);
    expect(field(form, 'Repo or app')).toHaveValue('acme/api');
    expect(field(form, 'Workflow')).toHaveValue('Deploy API');
    expect(field(form, 'Branch pattern')).toHaveValue('');
    fireEvent.click(within(form).getByRole('radio', { name: /Branches like/ }));
    expect(field(form, 'Repo or app')).toHaveValue('');
    expect(field(form, 'Branch pattern')).toHaveValue('feature/*');
    expect(within(form).getByText(/Matches 1 of the 2/)).toBeVisible();
  });

  it('disables Dismiss, saying why, while no field is set', () => {
    renderPanel();
    const form = openForm('Deploy API');
    fireEvent.change(field(form, 'Repo or app'), { target: { value: '' } });
    fireEvent.change(field(form, 'Workflow'), { target: { value: '' } });
    expect(dismissButton(form)).toBeDisabled();
    expect(dismissButton(form)).toHaveAccessibleDescription(
      'Set at least one field',
    );
    fireEvent.change(field(form, 'Branch pattern'), {
      target: { value: '**' },
    });
    expect(dismissButton(form)).toBeEnabled();
    expect(within(form).getByText(/Matches 2 of the 2/)).toBeVisible();
  });

  it('saves the pattern, hides what it matches and focuses the heading', () => {
    const saved = renderPanel();
    const form = openForm('Deploy API');
    choose(within(form).getByRole('combobox'), 'no row rule matches');
    fireEvent.click(dismissButton(form));
    const [added] = saved.at(-1)?.unmappedDismissals ?? [];
    expect(added).toMatchObject({
      where: 'acme/api',
      workflow: 'Deploy API',
      reason: 'no-row-matches',
    });
    expect(Object.keys(added).sort()).toEqual([
      'id',
      'reason',
      'where',
      'workflow',
    ]);
    expect(added.id).not.toBe('');
    expect(
      within(panel()).queryByRole('link', { name: 'Deploy API' }),
    ).toBeNull();
    expect(screen.queryByRole('form')).toBeNull();
    expect(heading()).toHaveTextContent('1 unmapped run, 1 dismissed');
    expect(document.activeElement).toBe(heading());
  });

  it('focuses the board title once the last entry is dismissed', async () => {
    renderPanel([deploy]);
    fireEvent.click(dismissButton(openForm('Deploy API')));
    await waitFor(() => {
      expect(document.activeElement?.id).toBe(BOARD_TITLE_ID);
    });
  });

  it('cancels on Escape back to Dismiss…, the panel still open; one form at a time', () => {
    renderPanel();
    openForm('Deploy API');
    const form = openForm('Nightly');
    expect(screen.getAllByRole('form')).toEqual([form]);
    fireEvent.keyDown(field(form, 'Workflow'), { key: 'Escape' });
    expect(screen.queryByRole('form')).toBeNull();
    expect(panel()).toBeVisible();
    expect(document.activeElement).toHaveAccessibleName('Dismiss…');
    expect(document.activeElement?.closest('li')?.textContent).toContain(
      'Nightly',
    );
  });

  it('lists dismissed entries with their pattern, and Undo brings them back', () => {
    const saved = renderPanel();
    fireEvent.click(dismissButton(openForm('Nightly')));
    const toggle = within(panel()).getByRole('button', {
      name: 'Show dismissed',
    });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    const list = within(panel()).getByRole('list', { name: 'Dismissed runs' });
    expect(within(list).getByRole('link', { name: 'Nightly' })).toBeVisible();
    expect(
      within(list).getByText(
        'Dismissed by Repo or app acme/api, Workflow Nightly',
      ),
    ).toBeVisible();
    fireEvent.click(within(list).getByRole('button', { name: 'Undo' }));
    expect(saved.at(-1)?.unmappedDismissals).toEqual([]);
    expect(
      within(panel()).getByRole('link', { name: 'Nightly' }),
    ).toBeVisible();
    expect(
      within(panel()).queryByRole('list', { name: 'Dismissed runs' }),
    ).toBeNull();
  });

  it('says Not saved when the save is refused, the form left open', () => {
    renderPanel(undefined, () => {
      throw new Error('storage full');
    });
    const form = openForm('Deploy API');
    fireEvent.click(dismissButton(form));
    expect(within(form).getByText(/storage full/)).toBeVisible();
    expect(screen.getByRole('form')).toBe(form);
    expect(
      within(panel()).getByRole('link', { name: 'Deploy API' }),
    ).toBeVisible();
  });
});

describe('the presets’ guards', () => {
  it('offers no branch preset without a branch, the field empty', () => {
    renderPanel([entry(3, { branch: null }), nightly]);
    const form = openForm('Deploy API');
    expect(
      within(form)
        .getAllByRole('radio')
        .map((p) => p.getAttribute('value')),
    ).toEqual(['workflow', 'reason']);
    expect(field(form, 'Branch pattern')).toHaveValue('');
  });

  it('hides Branches like this for a one-segment branch', () => {
    renderPanel();
    const form = openForm('Nightly');
    expect(
      within(form).queryByRole('radio', { name: /Branches like/ }),
    ).toBeNull();
  });
});
