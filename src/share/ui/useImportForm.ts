/**
 * The import dialog's choices (spec.md §3.8): which dashboards (all at
 * first), add or replace the whole setup, *replace* or *keep as a copy*
 * for each dashboard whose id is already here, whether to import the
 * share's credentials (and the passphrase for encrypted ones), and
 * *Remember on this device* (off: imported secrets are this tab's only,
 * as when a secret is entered, C-5). Planning decrypts the credentials
 * only if they are imported; nothing is written here.
 *
 * @module
 */
import { useState } from 'react';

import type { Dashboard } from '@/domain/config/dashboard';

import type { Share } from '../envelope';
import {
  type ImportMode,
  type ImportPlan,
  planImport,
  type SameIdChoice,
} from '../importPlan';
import { decryptSecrets, type ShareSecrets } from '../secrets';
import { DAMAGED_CREDENTIALS, WRONG_PASSPHRASE } from './shareWords';

/** The import form's state and actions. */
export interface ImportForm {
  selected: ReadonlySet<string>;
  setSelected: (selected: Set<string>) => void;
  mode: ImportMode;
  setMode: (mode: ImportMode) => void;
  /** Is `id` already here (so *replace* or *keep as a copy*)? */
  clashes: (id: string) => boolean;
  sameIdOf: (id: string) => SameIdChoice;
  setSameId: (id: string, choice: SameIdChoice) => void;
  /** Does the share carry credentials? */
  carried: boolean;
  withCredentials: boolean;
  setWithCredentials: (on: boolean) => void;
  asksPassphrase: boolean;
  passphrase: string;
  setPassphrase: (text: string) => void;
  remember: boolean;
  setRemember: (on: boolean) => void;
  error: string | null;
  setError: (error: string | null) => void;
  busy: boolean;
  ready: boolean;
  /** Plan the import, or `null` (with `error` set) if it can't be. */
  plan: () => Promise<ImportPlan | null>;
}

export function useImportForm(
  share: Share,
  existing: readonly Dashboard[],
): ImportForm {
  const [selected, setSelected] = useState(
    () => new Set(share.dashboards.map((d) => d.id)),
  );
  const [mode, setMode] = useState<ImportMode>('add');
  const [sameId, setSameId] = useState<Record<string, SameIdChoice>>({});
  const carried = share.credentials.kind !== 'none';
  const [withCredentials, setWithCredentials] = useState(carried);
  const [passphrase, setPassphrase] = useState('');
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const chosen = share.dashboards.filter((d) => selected.has(d.id));
  const here = new Set(existing.map((d) => d.id));
  const importing = carried && withCredentials;
  const asksPassphrase = importing && share.credentials.kind === 'encrypted';

  /** The share's secrets as chosen, or a message why not. */
  const secrets = async (): Promise<ShareSecrets | null | string> => {
    const c = share.credentials;
    if (!importing || c.kind === 'none') return null;
    if (c.kind === 'plain') return c.secrets;
    const opened = await decryptSecrets(c.block, passphrase);
    if (opened.ok) return opened.secrets;
    return opened.reason === 'wrongPassphrase'
      ? WRONG_PASSPHRASE
      : DAMAGED_CREDENTIALS;
  };

  const plan = async (): Promise<ImportPlan | null> => {
    setBusy(true);
    setError(null);
    try {
      const got = await secrets();
      if (typeof got === 'string') {
        setError(got);
        return null;
      }
      return planImport(existing, {
        dashboards: chosen,
        mode,
        sameId,
        secrets: got,
      });
    } finally {
      setBusy(false);
    }
  };

  return {
    selected,
    setSelected,
    mode,
    setMode,
    clashes: (id: string) => mode === 'add' && here.has(id),
    sameIdOf: (id) => sameId[id] ?? 'replace',
    setSameId: (id, choice) => {
      setSameId((s) => ({ ...s, [id]: choice }));
    },
    carried,
    withCredentials,
    setWithCredentials: (on) => {
      setError(null);
      setWithCredentials(on);
    },
    asksPassphrase,
    passphrase,
    setPassphrase: (text) => {
      setError(null);
      setPassphrase(text);
    },
    remember,
    setRemember,
    error,
    setError,
    busy,
    ready: chosen.length > 0 && !busy && !(asksPassphrase && passphrase === ''),
    plan,
  };
}
