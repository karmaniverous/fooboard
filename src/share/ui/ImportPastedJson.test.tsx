/**
 * Tests for pasting a share's JSON into the import dialog (spec 0.2.0
 * §3.J *Pasting JSON*, *Keys on arrival*): JSON text imports as a file
 * would, and the board opens asking for the first credential, by name,
 * whose secret this device lacks; a refused JSON paste lists its errors.
 * Pasted JSON is called a share, never a link.
 *
 * @module
 */
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { sortCredentials } from '@/credentials/credentialOrder';
import { createAppStores } from '@/storage';
import { memoryStorage } from '@/storage/keyValue';
import { LocationState } from '@/test/LocationState';
import {
  dialog,
  importNow,
  renderImport,
  savedIds,
  where,
} from '@/test/renderImport';
import { shareBoard } from '@/test/shareBoard';

import { buildEnvelope } from '../envelope';
import { PASTE_LABEL } from './ShareInputs';

const board = shareBoard();
const json = JSON.stringify(buildEnvelope([board], null), null, 2);
const [first, second] = sortCredentials(board.credentials);

const paste = (text: string) => {
  fireEvent.change(within(dialog()).getByLabelText(PASTE_LABEL), {
    target: { value: text },
  });
};
const state = () => screen.getByTestId('location-state').textContent;

describe('the import dialog, from pasted JSON', () => {
  it('imports it and opens the board on the first credential with no secret', async () => {
    const stores = renderImport(null, undefined, <LocationState />);
    fireEvent.click(screen.getByRole('button', { name: 'Open import' }));
    paste(`\n${json}\n`);
    expect(
      within(dialog()).getByText('This share holds 1 dashboard.'),
    ).toBeVisible();
    await importNow();
    expect(savedIds(stores)).toEqual([board.id]);
    expect(where()).toBe(`/d/${board.id}`);
    expect(state()).toBe(JSON.stringify({ openCredential: first.id }));
  });

  it('asks for the next credential when the first one has its secret here', async () => {
    const stores = createAppStores(memoryStorage());
    stores.credentials.set(first.id, { kind: 'github', token: 't' }, false);
    renderImport(null, stores, <LocationState />);
    fireEvent.click(screen.getByRole('button', { name: 'Open import' }));
    paste(json);
    await importNow();
    expect(state()).toBe(JSON.stringify({ openCredential: second.id }));
  });

  it('lists the errors of JSON that is refused, calling it a share', () => {
    renderImport();
    fireEvent.click(screen.getByRole('button', { name: 'Open import' }));
    paste('{"format":"fooboard-share","formatVersion":1}');
    expect(within(dialog()).getByRole('alert')).toHaveTextContent(
      "This share has problems fooboard can't import:",
    );
    expect(within(dialog()).queryByText(/This link/)).toBeNull();
    expect(
      within(dialog()).getByRole('list', { name: 'Import errors' }),
    ).toHaveTextContent(/schemaVersion: /);
  });
});
