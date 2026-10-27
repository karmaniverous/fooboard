/**
 * Helpers for the import's questions about secrets (spec.md §3.8,
 * Decision 70): a device that already holds the share-test board with its
 * own secrets, shares of that board carrying other secrets, and the
 * dialog's questions, answers and *Import* button.
 *
 * @module
 */
import { fireEvent, within } from '@testing-library/react';

import { buildEnvelope } from '@/share/envelope';
import type { LinkPayload } from '@/share/link';
import { encryptSecrets, type ShareSecrets } from '@/share/secrets';
import { SECRET_QUESTION } from '@/share/ui/shareWords';
import { type AppStores, createAppStores } from '@/storage';
import { dashboardsOf } from '@/storage/configStore';
import type { CredentialSecret } from '@/storage/credentialStore';
import { memoryStorage } from '@/storage/keyValue';

import { dialog, payloadOf } from './renderImport';
import { shareBoard } from './shareBoard';

export const MINE = { kind: 'github', token: 'ghp_mine' } as const;
export const THEIRS = { kind: 'github', token: 'ghp_theirs' } as const;
export const AWS_MINE = {
  kind: 'aws',
  accessKeyId: 'AKIAEXAMPLE',
  secretAccessKey: 'mine-secret',
} as const;
export const AWS_THEIRS = { ...AWS_MINE, secretAccessKey: 'theirs-secret' };

/** The question for the share-test board's GitHub token. */
export const GH_QUESTION = `GitHub token Northwind org: ${SECRET_QUESTION}`;
/** The question for its production AWS key. */
export const AWS_QUESTION = `AWS key Prod account: ${SECRET_QUESTION}`;

/** A device holding the share-test board and `secrets` (remembered or
 * this tab's, per `remembered`). */
export function deviceWith(
  secrets: Record<string, CredentialSecret>,
  remembered = true,
): AppStores {
  const stores = createAppStores(memoryStorage());
  stores.config.saveDashboard(shareBoard());
  for (const [id, secret] of Object.entries(secrets))
    stores.credentials.set(id, secret, remembered);
  return stores;
}

/** The share-test board's update (renamed, so a write shows). */
const update = () => ({ ...shareBoard(), name: 'Northwind v2' });

/** A link to the update carrying `secrets` in plain. */
export const plainShare = (secrets: ShareSecrets): LinkPayload =>
  payloadOf(buildEnvelope([update()], { encrypted: false, secrets }));

/** A link to the update carrying `secrets` encrypted with `passphrase`. */
export const encryptedShare = async (
  secrets: ShareSecrets,
  passphrase: string,
): Promise<LinkPayload> =>
  payloadOf(
    buildEnvelope([update()], await encryptSecrets(secrets, passphrase, 1_000)),
  );

export const importButton = (): HTMLElement =>
  within(dialog()).getByRole('button', { name: 'Import' });
export const questions = (): HTMLElement[] =>
  within(dialog()).queryAllByRole('radiogroup');
export const question = (name: string): HTMLElement =>
  within(dialog()).getByRole('radiogroup', { name });

/** Answer the question `name` with the option labelled `label`. */
export function answer(name: string, label: string): void {
  fireEvent.click(within(question(name)).getByRole('radio', { name: label }));
}

/** The names of the dashboards saved on `stores`' device. */
export const savedNames = (stores: AppStores): string[] =>
  dashboardsOf(stores.config.load()).map((d) => d.name);
