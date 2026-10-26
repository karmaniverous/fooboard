/**
 * Tests for where an import comes from (spec.md §3.8): a file chosen in
 * the dialog (a v4 file opening as v6, a damaged file in the error
 * state, and another file chosen after it), and a share link pasted into
 * an open tab, whose fragment is cleared as it arrives before the dialog
 * opens over the home page.
 *
 * @module
 */
import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import v4Board from '@/domain/config/fixtures/v4-board.json';
import {
  fragmentOf,
  payloadOf,
  renderImport,
  savedIds,
  where,
} from '@/test/renderImport';
import { shareBoard } from '@/test/shareBoard';

import { buildEnvelope } from '../envelope';

const dialog = () => screen.getByRole('dialog', { name: 'Import dashboards' });

/** Choose a file holding `text` in the dialog's file field. */
const chooseFile = async (text: string) => {
  await act(async () => {
    fireEvent.change(within(dialog()).getByLabelText('A fooboard file'), {
      target: { files: [new File([text], 'share.json')] },
    });
    await Promise.resolve();
  });
};

afterEach(() => {
  window.history.replaceState(null, '', '/');
});

describe('importing from a file', () => {
  it('opens a v4 file as v6 and imports it', async () => {
    const stores = renderImport();
    fireEvent.click(screen.getByRole('button', { name: 'Open import' }));
    await chooseFile(
      JSON.stringify({
        ...buildEnvelope([shareBoard()], null),
        schemaVersion: 4,
        dashboards: v4Board.dashboards,
      }),
    );
    const list = await within(dialog()).findByRole('list', {
      name: 'Dashboards to import',
    });
    expect(within(list).getAllByRole('checkbox')).toHaveLength(1);
    expect(
      within(dialog()).getByText('This file holds 1 dashboard.'),
    ).toBeVisible();
    await act(async () => {
      fireEvent.click(within(dialog()).getByRole('button', { name: 'Import' }));
      await Promise.resolve();
    });
    expect(savedIds(stores)).toEqual(['fabrikam']);
    const loaded = stores.config.load();
    expect(loaded.kind === 'ok' && loaded.root.schemaVersion).toBe(6);
  });

  it('shows the error state for a damaged file, then reads another', async () => {
    renderImport();
    fireEvent.click(screen.getByRole('button', { name: 'Open import' }));
    await chooseFile('{"dashboards": [');
    expect(await within(dialog()).findByRole('alert')).toHaveTextContent(
      "This file isn't a fooboard board, or it's damaged.",
    );
    expect(
      within(dialog()).getByText('Ask whoever sent it for a new file.'),
    ).toBeVisible();
    await chooseFile(JSON.stringify(buildEnvelope([shareBoard()], null)));
    await waitFor(() => {
      expect(within(dialog()).queryByRole('alert')).toBeNull();
    });
    expect(
      within(dialog()).getByRole('list', { name: 'Dashboards to import' }),
    ).toBeInTheDocument();
  });
});

describe('a share link pasted into an open tab', () => {
  it('clears the fragment, then opens the dialog over the home page', async () => {
    renderImport();
    expect(where()).toBe('/demo');
    await act(async () => {
      window.location.hash = fragmentOf(buildEnvelope([shareBoard()], null));
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(dialog()).toBeInTheDocument();
    });
    expect(window.location.hash).toBe('');
    expect(where()).toBe('/');
    expect(
      within(dialog()).getByRole('checkbox', { name: shareBoard().name }),
    ).toBeChecked();
  });

  it("gives a second link a fresh form, not the first one's choices", async () => {
    renderImport(payloadOf(buildEnvelope([shareBoard()], null)));
    fireEvent.click(
      within(dialog()).getByRole('checkbox', { name: shareBoard().name }),
    );
    expect(
      within(dialog()).getByRole('button', { name: 'Import' }),
    ).toBeDisabled();
    await act(async () => {
      window.location.hash = fragmentOf(buildEnvelope([shareBoard()], null));
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(
        within(dialog()).getByRole('checkbox', { name: shareBoard().name }),
      ).toBeChecked();
    });
    expect(window.location.hash).toBe('');
    expect(
      within(dialog()).getByRole('button', { name: 'Import' }),
    ).toBeEnabled();
  });

  it('ignores any other fragment', async () => {
    renderImport();
    await act(async () => {
      window.location.hash = '#section';
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(window.location.hash).toBe('#section');
    expect(where()).toBe('/demo');
  });
});
