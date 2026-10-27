/**
 * Tests for sharing saved dashboards (spec.md §3.8): every dashboard
 * chosen at first, with *Select all*; a link carrying no secret unless
 * credentials are included; included credentials encrypted by default,
 * with a passphrase required, or plain when unticked; a link over 32,000
 * characters refused for a file; a file download; *Post this board on X*
 * never carrying credentials, warning about repo and branch names, and
 * offered only within X's link length.
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
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ShareDialog } from '@/components/ShareDialog';
import type { Dashboard } from '@/domain/config/dashboard';
import { createAppStores } from '@/storage';
import { memoryStorage } from '@/storage/keyValue';
import { windowAt } from '@/test/linkWindow';
import { renderShell } from '@/test/renderShell';
import { shareBoard } from '@/test/shareBoard';

import { readShare, type ShareCredentialsIn } from '../envelope';
import { takeShareLink } from '../link';
import { decryptSecrets } from '../secrets';

const gh = { kind: 'github', token: 'ghp_topsecret' } as const;
const board = shareBoard();
const writes: string[] = [];

/** `count` dashboards, each with a unique id and its own rows. */
const many = (count: number): Dashboard[] =>
  Array.from({ length: count }, (_, i) => ({
    ...board,
    id: crypto.randomUUID(),
    name: `${board.name} ${crypto.randomUUID()}`,
    credentials: board.credentials.map((c) => ({
      ...c,
      id: crypto.randomUUID(),
    })),
    settings: { requestsInFlight: board.settings.requestsInFlight },
    rowGroups: [],
    columnGroups: [],
    stages: board.stages.map((s) => ({ ...s, settings: {} })),
    rows: board.rows
      .filter((r) => r.type === 'github')
      .map((r) => ({
        ...r,
        id: `${r.id}-${String(i)}`,
        settings: {},
        cellSettings: {},
      })),
  }));

function show(dashboards: Dashboard[] = [board]) {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText: (text: string) => {
        writes.push(text);
        return Promise.resolve();
      },
    },
  });
  const stores = createAppStores(memoryStorage());
  stores.config.save({ schemaVersion: 6, dashboards });
  stores.credentials.set('gh-org', gh, true);
  renderShell(
    <ShareDialog open onOpenChange={() => undefined} />,
    undefined,
    stores,
  );
  return within(screen.getByRole('region', { name: 'Your dashboards' }));
}

afterEach(() => {
  writes.length = 0;
  Reflect.deleteProperty(navigator, 'clipboard');
  vi.restoreAllMocks();
});

/** Press a button, letting the share be built and copied. */
const press = async (panel: ReturnType<typeof show>, name: string) => {
  await act(async () => {
    fireEvent.click(panel.getByRole('button', { name }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

/** What the last copied link holds. */
function copied(): {
  dashboards: Dashboard[];
  credentials: ShareCredentialsIn;
} {
  const payload = takeShareLink(windowAt(writes.at(-1) ?? ''), '/');
  const read = payload?.kind === 'text' ? readShare(payload.text) : null;
  if (!read?.ok) throw new Error('the copied link is not a share');
  return read.share;
}

describe('sharing saved dashboards', () => {
  it('copies a link with every dashboard and no secret by default', async () => {
    const panel = show([board, { ...(many(1)[0] ?? board), name: 'Second' }]);
    expect(panel.getByRole('checkbox', { name: 'Select all' })).toBeChecked();
    expect(
      panel.getByRole('checkbox', { name: 'Include credentials' }),
    ).not.toBeChecked();
    fireEvent.click(panel.getByRole('checkbox', { name: 'Second' }));
    await press(panel, 'Copy board link');
    expect(screen.getAllByRole('status')[0]).toHaveTextContent('Link copied.');
    expect(writes.at(-1)).not.toContain('ghp_topsecret');
    expect(copied()).toEqual({
      dashboards: [board],
      credentials: { kind: 'none' },
    });
  });

  it('needs a dashboard chosen', () => {
    const panel = show(many(2));
    fireEvent.click(panel.getByRole('checkbox', { name: 'Select all' }));
    expect(
      panel.getByRole('button', { name: 'Copy board link' }),
    ).toBeDisabled();
    expect(panel.getByRole('button', { name: 'Download file' })).toBeDisabled();
    expect(
      panel.queryByRole('link', { name: 'Post this board on X' }),
    ).toBeNull();
  });

  it('encrypts included credentials by default, under a passphrase', async () => {
    const panel = show();
    fireEvent.click(
      panel.getByRole('checkbox', { name: 'Include credentials' }),
    );
    expect(
      panel.getByText(/Anyone holding this link or file can use/),
    ).toBeVisible();
    expect(panel.getByText(/Only 1 of 4 have a secret/)).toBeVisible();
    expect(
      panel.getByRole('checkbox', { name: 'Encrypt them with a passphrase' }),
    ).toBeChecked();
    expect(
      panel.getByRole('button', { name: 'Copy board link' }),
    ).toBeDisabled();
    expect(
      panel.getByText(/Enter a passphrase to copy or download/),
    ).toBeVisible();
    fireEvent.change(panel.getByLabelText('Passphrase'), {
      target: { value: 'hunter22' },
    });
    expect(panel.getByText(/Send the passphrase separately/)).toBeVisible();
    await press(panel, 'Copy board link');
    await waitFor(() => {
      expect(writes).toHaveLength(1);
    });
    const { credentials } = copied();
    if (credentials.kind !== 'encrypted')
      throw new Error('expected encryption');
    expect(writes.at(-1)).not.toContain('ghp_topsecret');
    expect(await decryptSecrets(credentials.block, 'hunter22')).toEqual({
      ok: true,
      secrets: { 'gh-org': gh },
    });
  });

  it('includes plain credentials when encryption is unticked', async () => {
    const panel = show();
    fireEvent.click(
      panel.getByRole('checkbox', { name: 'Include credentials' }),
    );
    fireEvent.click(
      panel.getByRole('checkbox', { name: 'Encrypt them with a passphrase' }),
    );
    await press(panel, 'Copy board link');
    expect(copied().credentials).toEqual({
      kind: 'plain',
      secrets: { 'gh-org': gh },
    });
  });

  it('never puts credentials in the X post, and warns what the link reveals', () => {
    const [second] = many(1);
    const panel = show([board, second]);
    fireEvent.click(
      panel.getByRole('checkbox', { name: 'Include credentials' }),
    );
    fireEvent.click(
      panel.getByRole('checkbox', { name: 'Encrypt them with a passphrase' }),
    );
    // Choose the dashboards after the credentials, so the post is built
    // with plain credentials included.
    fireEvent.click(panel.getByRole('checkbox', { name: second.name }));
    const post = panel.getByRole('link', { name: 'Post this board on X' });
    const link =
      new URL(post.getAttribute('href') ?? '').searchParams.get('url') ?? '';
    expect(link).not.toContain('ghp_topsecret');
    writes.push(link);
    expect(copied()).toEqual({
      dashboards: [board],
      credentials: { kind: 'none' },
    });
    expect(panel.getByText(/reveals repo and branch names/)).toBeVisible();
  });

  it('refuses a link over 32,000 characters, and an X post over 4,096', async () => {
    const panel = show(many(300));
    expect(
      panel.queryByRole('link', { name: 'Post this board on X' }),
    ).toBeNull();
    expect(panel.getByText(/Too long to post on X/)).toBeVisible();
    await press(panel, 'Copy board link');
    expect(writes).toEqual([]);
    expect(screen.getAllByRole('status')[0]).toHaveTextContent(
      /more than the 32,000 a link can hold\. Download a file instead\./,
    );
  });

  it('downloads the share as a file', async () => {
    const blobs: Blob[] = [];
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      if (blob instanceof Blob) blobs.push(blob);
      return 'blob:x';
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
      () => undefined,
    );
    const panel = show();
    await press(panel, 'Download file');
    expect(screen.getAllByRole('status')[0]).toHaveTextContent('File saved.');
    const [blob] = blobs;
    expect(readShare(await blob.text())).toMatchObject({
      ok: true,
      share: { dashboards: [board] },
    });
  });

  it('says when the link could not be copied, or the share built', async () => {
    const panel = show();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: () => Promise.reject(new Error('denied')) },
    });
    await press(panel, 'Copy board link');
    expect(screen.getAllByRole('status')[0]).toHaveTextContent(
      /Couldn't copy the link/,
    );
    vi.spyOn(crypto.subtle, 'importKey').mockRejectedValue(
      new Error('no crypto'),
    );
    fireEvent.click(
      panel.getByRole('checkbox', { name: 'Include credentials' }),
    );
    fireEvent.change(panel.getByLabelText('Passphrase'), {
      target: { value: 'p' },
    });
    await press(panel, 'Download file');
    expect(screen.getAllByRole('status')[0]).toHaveTextContent(
      /Couldn't build the share: .*no crypto/,
    );
  });
});
