/**
 * Tests for the import dialog opened by a share link (spec.md §3.8): the
 * error state for a damaged, foreign or newer link; the dashboards listed
 * and all selected; nothing written before *Import* and nothing at all on
 * *Cancel*, which discards the link; adding, replacing or keeping a copy
 * of a dashboard already here; replacing the whole setup only after
 * confirmation; and the page the app opens afterwards.
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
import { describe, expect, it } from 'vitest';

import type { Dashboard } from '@/domain/config/dashboard';
import { createAppStores } from '@/storage';
import { memoryStorage } from '@/storage/keyValue';
import { choose } from '@/test/choose';
import {
  dialog,
  payloadOf,
  renderImport,
  savedIds,
  where,
} from '@/test/renderImport';
import { shareBoard } from '@/test/shareBoard';

import { buildEnvelope } from '../envelope';

const board = shareBoard();
const other: Dashboard = { ...board, id: 'two', name: 'Two', credentials: [] };
const strip = (d: Dashboard): Dashboard => ({
  ...d,
  rows: d.rows.filter((r) => r.type === 'github' && !r.settings.githubToken),
  rowGroups: [],
  columnGroups: [],
  stages: d.stages.map((s) => ({ ...s, settings: {} })),
  settings: { requestsInFlight: d.settings.requestsInFlight },
});
const two = strip(other);
const press = async (name: string) => {
  await act(async () => {
    fireEvent.click(within(dialog()).getByRole('button', { name }));
    await Promise.resolve();
  });
};

/** Stores already holding `dashboards`. */
const holding = (...dashboards: Dashboard[]) => {
  const stores = createAppStores(memoryStorage());
  for (const d of dashboards) stores.config.saveDashboard(d);
  return stores;
};

describe('the import dialog, from a link', () => {
  it.each([
    [
      'damaged',
      { kind: 'damaged' as const },
      "This link isn't a fooboard board, or it's damaged.",
    ],
    [
      'not a share',
      payloadOf('{"schemaVersion":6}'),
      "This link isn't a fooboard board, or it's damaged.",
    ],
    [
      'newer',
      payloadOf(JSON.stringify({ format: 'fooboard-share', formatVersion: 2 })),
      'This link was made with a newer fooboard; reload to update.',
    ],
  ])('shows the error state for a %s link', (_, link, message) => {
    const stores = renderImport(link);
    expect(within(dialog()).getByRole('alert')).toHaveTextContent(message);
    expect(
      within(dialog()).queryByText(
        'Ask whoever sent it for a new link, or for a file.',
      ) !== null,
    ).toBe(!message.includes('newer'));
    expect(
      within(dialog()).queryByRole('button', { name: 'Import' }),
    ).toBeNull();
    expect(within(dialog()).queryByLabelText('A fooboard file')).toBeNull();
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(savedIds(stores)).toEqual([]);
  });

  it('lists every dashboard, all selected, and writes nothing until Import', async () => {
    const stores = renderImport(payloadOf(buildEnvelope([board, two], null)));
    expect(
      within(dialog()).getByText('This link holds 2 dashboards.'),
    ).toBeVisible();
    const list = within(dialog()).getByRole('list', {
      name: 'Dashboards to import',
    });
    for (const name of [board.name, 'Two']) {
      expect(within(list).getByRole('checkbox', { name })).toBeChecked();
    }
    fireEvent.click(
      within(dialog()).getByRole('checkbox', { name: 'Select all' }),
    );
    expect(
      within(dialog()).getByRole('button', { name: 'Import' }),
    ).toBeDisabled();
    fireEvent.click(
      within(dialog()).getByRole('checkbox', { name: 'Select all' }),
    );
    expect(within(list).getByRole('checkbox', { name: 'Two' })).toBeChecked();
    fireEvent.click(
      within(dialog()).getByRole('checkbox', { name: 'Select all' }),
    );
    fireEvent.click(within(list).getByRole('checkbox', { name: 'Two' }));
    expect(savedIds(stores)).toEqual([]);
    await press('Import');
    expect(savedIds(stores)).toEqual(['two']);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(where()).toBe('/d/two');
  });

  it('opens the home page after importing several', async () => {
    const stores = renderImport(payloadOf(buildEnvelope([board, two], null)));
    await press('Import');
    expect(savedIds(stores)).toEqual([board.id, 'two']);
    expect(where()).toBe('/');
  });

  it('discards the link on Cancel, writing nothing', async () => {
    const stores = renderImport(payloadOf(buildEnvelope([board], null)));
    await press('Cancel');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(savedIds(stores)).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Open import' }));
    expect(
      within(dialog()).getByLabelText('A fooboard file'),
    ).toBeInTheDocument();
    expect(within(dialog()).queryByRole('list')).toBeNull();
  });

  it('replaces a dashboard already here by default, keeping its ids', async () => {
    const stores = holding({ ...board, name: 'Mine' }, two);
    renderImport(payloadOf(buildEnvelope([board], null)), stores);
    expect(
      within(dialog()).getByRole('combobox', {
        name: `${board.name}: already here`,
      }),
    ).toHaveTextContent('Replace mine');
    await press('Import');
    const loaded = stores.config.load();
    expect(loaded.kind === 'ok' && loaded.root.dashboards).toEqual([
      board,
      two,
    ]);
    expect(where()).toBe(`/d/${board.id}`);
  });

  it('keeps a copy under new ids when asked', async () => {
    const stores = holding(board);
    renderImport(payloadOf(buildEnvelope([board], null)), stores);
    choose(
      within(dialog()).getByRole('combobox', {
        name: `${board.name}: already here`,
      }),
      'Keep as a copy',
    );
    await press('Import');
    const ids = savedIds(stores);
    expect(ids).toHaveLength(2);
    const [, copyId] = ids;
    expect(copyId).not.toBe(board.id);
    expect(where()).toBe(`/d/${copyId}`);
    const loaded = stores.config.load();
    const copy = loaded.kind === 'ok' ? loaded.root.dashboards[1] : undefined;
    expect(copy?.name).toBe(`${board.name} (copy)`);
    expect(copy?.credentials.map((c) => c.id)).not.toContain('gh-org');
  });

  it('says why, writing nothing, when the saved setup is unreadable', async () => {
    const device = memoryStorage();
    device.setItem('fooboard:config', '{not json');
    const stores = renderImport(
      payloadOf(buildEnvelope([board], null)),
      createAppStores(device),
    );
    await press('Import');
    expect(within(dialog()).getByRole('alert')).toHaveTextContent(
      /Refusing to overwrite unreadable configuration/,
    );
    expect(device.getItem('fooboard:config')).toBe('{not json');
    expect(stores.config.load().kind).toBe('unreadable');
    expect(where()).toBe('/demo');
  });

  it('replaces the whole setup only after confirmation', async () => {
    const stores = holding({
      ...two,
      credentials: [{ id: 'two-secret', kind: 'github', label: 'Two token' }],
    });
    stores.credentials.set('two-secret', { kind: 'github', token: 't' }, true);
    renderImport(payloadOf(buildEnvelope([board], null)), stores);
    choose(
      within(dialog()).getByRole('combobox', { name: 'How to import' }),
      'Replace the whole setup',
    );
    expect(
      within(dialog()).queryByRole('combobox', { name: /already here/ }),
    ).toBeNull();
    await press('Import');
    const confirm = screen.getByRole('alertdialog', {
      name: 'Replace the whole setup?',
    });
    fireEvent.click(within(confirm).getByRole('button', { name: 'Cancel' }));
    expect(savedIds(stores)).toEqual(['two']);
    await press('Import');
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: 'Replace',
      }),
    );
    await waitFor(() => {
      expect(savedIds(stores)).toEqual([board.id]);
    });
    expect(stores.credentials.get('two-secret')).toBeUndefined();
    expect(where()).toBe(`/d/${board.id}`);
  });
});
