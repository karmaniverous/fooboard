/**
 * Tests for a share's credentials in the import dialog (spec.md §3.8):
 * imported for this tab only unless *Remember on this device*; the
 * passphrase asked for only for encrypted credentials the user imports;
 * a wrong passphrase said, with nothing written, and the dashboards still
 * importable without them; a secret only for credentials the imported
 * dashboards reference; a secret the browser won't store reported after
 * the dashboards are imported.
 *
 * @module
 */
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createAppStores } from '@/storage';
import { memoryStorage } from '@/storage/keyValue';
import { LEFTOVER_SECRETS_HINT } from '@/storage/leftoverSecrets';
import {
  box,
  dialog,
  importNow,
  payloadOf,
  renderImport,
  savedIds,
  where,
} from '@/test/renderImport';
import { shareBoard } from '@/test/shareBoard';

import { buildEnvelope } from '../envelope';
import { encryptSecrets, type ShareSecrets } from '../secrets';
import { WRONG_PASSPHRASE } from './shareWords';

const board = shareBoard();
const gh = { kind: 'github', token: 'ghp_shared' } as const;
const secrets: ShareSecrets = {
  'gh-org': gh,
  stranger: { kind: 'github', token: 'not-referenced' },
};
const encrypted = async () =>
  payloadOf(
    buildEnvelope([board], await encryptSecrets(secrets, 'opensesame', 1_000)),
  );

describe('credentials in the import dialog', () => {
  it('imports plain secrets for this tab only by default', async () => {
    const stores = renderImport(
      payloadOf(buildEnvelope([board], { encrypted: false, secrets })),
    );
    expect(
      within(dialog()).getByText(
        'This link holds 1 dashboard and credentials.',
      ),
    ).toBeVisible();
    expect(box('Import its credentials')).toBeChecked();
    expect(box('Remember on this device')).not.toBeChecked();
    expect(within(dialog()).queryByLabelText('Passphrase')).toBeNull();
    await importNow();
    expect(stores.credentials.get('gh-org')).toEqual(gh);
    expect(stores.credentials.isRemembered('gh-org')).toBe(false);
    expect(stores.credentials.get('stranger')).toBeUndefined();
  });

  it('remembers them on this device when ticked', async () => {
    const stores = renderImport(
      payloadOf(buildEnvelope([board], { encrypted: false, secrets })),
    );
    fireEvent.click(box('Remember on this device'));
    await importNow();
    expect(stores.credentials.isRemembered('gh-org')).toBe(true);
  });

  it('imports the dashboards alone when the credentials are unticked', async () => {
    const stores = renderImport(
      payloadOf(buildEnvelope([board], { encrypted: false, secrets })),
    );
    fireEvent.click(box('Import its credentials'));
    expect(
      within(dialog()).queryByRole('checkbox', {
        name: 'Remember on this device',
      }),
    ).toBeNull();
    await importNow();
    expect(savedIds(stores)).toEqual([board.id]);
    expect(stores.credentials.get('gh-org')).toBeUndefined();
  });

  it('offers nothing about credentials when the share has none', () => {
    renderImport(payloadOf(buildEnvelope([board], null)));
    expect(
      within(dialog()).queryByRole('checkbox', {
        name: 'Import its credentials',
      }),
    ).toBeNull();
  });

  it('asks for the passphrase only for encrypted credentials being imported', async () => {
    renderImport(await encrypted());
    expect(
      within(dialog()).getByText(
        'This link holds 1 dashboard and credentials encrypted with a passphrase.',
      ),
    ).toBeVisible();
    const field = within(dialog()).getByLabelText('Passphrase');
    expect(
      within(dialog()).getByRole('button', { name: 'Import' }),
    ).toBeDisabled();
    expect(field).toHaveAttribute('type', 'password');
    fireEvent.click(box('Import its credentials'));
    expect(within(dialog()).queryByLabelText('Passphrase')).toBeNull();
    expect(
      within(dialog()).getByRole('button', { name: 'Import' }),
    ).toBeEnabled();
  });

  it('says a wrong passphrase, writes nothing, and still imports without them', async () => {
    const stores = renderImport(await encrypted());
    fireEvent.change(within(dialog()).getByLabelText('Passphrase'), {
      target: { value: 'wrong' },
    });
    await importNow();
    await waitFor(() => {
      expect(within(dialog()).getByRole('alert')).toHaveTextContent(
        WRONG_PASSPHRASE,
      );
    });
    expect(savedIds(stores)).toEqual([]);
    expect(stores.credentials.get('gh-org')).toBeUndefined();
    fireEvent.click(box('Import its credentials'));
    expect(within(dialog()).queryByRole('alert')).toBeNull();
    await importNow();
    expect(savedIds(stores)).toEqual([board.id]);
    expect(stores.credentials.get('gh-org')).toBeUndefined();
  });

  it('reports secrets it could not store once the dashboards are imported', async () => {
    // A browser that won't remove a secret's device copy (the
    // configuration saves as usual).
    const base = memoryStorage();
    const device = {
      ...base,
      removeItem: (key: string) => {
        if (key.startsWith('fooboard:credential:')) throw new Error('refused');
        base.removeItem(key);
      },
    };
    const stores = renderImport(
      payloadOf(buildEnvelope([board], { encrypted: false, secrets })),
      createAppStores(device),
    );
    await importNow();
    expect(within(dialog()).getByRole('alert')).toHaveTextContent(
      LEFTOVER_SECRETS_HINT,
    );
    expect(savedIds(stores)).toEqual([board.id]);
    expect(
      within(dialog()).queryByRole('button', { name: 'Import' }),
    ).toBeNull();
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(where()).toBe(`/d/${board.id}`);
  });

  it('opens encrypted credentials with the right passphrase', async () => {
    const stores = renderImport(await encrypted());
    fireEvent.change(within(dialog()).getByLabelText('Passphrase'), {
      target: { value: 'opensesame' },
    });
    await importNow();
    await waitFor(() => {
      expect(stores.credentials.get('gh-org')).toEqual(gh);
    });
    expect(stores.credentials.isRemembered('gh-org')).toBe(false);
    expect(stores.credentials.get('stranger')).toBeUndefined();
  });
});
