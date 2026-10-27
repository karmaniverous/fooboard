/**
 * The import dialog's choices (spec.md §3.8): which dashboards (all at
 * first), add or replace the whole setup, *replace* or *keep as a copy*
 * for each dashboard whose id is already here, whether to import the
 * share's credentials (and the passphrase for encrypted ones), and
 * *Remember on this device* (off: imported secrets are this tab's only,
 * as when a secret is entered, C-5). Planning decrypts the credentials
 * only if they are imported; nothing is written here.
 *
 * When the share's secret for a credential differs from the one this
 * device holds, the form asks whether to keep this device's or use the
 * share's (Decision 70; `secretQuestions`), with nothing chosen, and
 * isn't ready until every question is answered. Encrypted credentials
 * are compared only once the passphrase has opened them: the first
 * *Import* opens them and, if anything differs, stops to ask. Unticking
 * *Import its credentials* or changing the passphrase drops the questions
 * and their answers.
 *
 * @module
 */
import { useState } from 'react';

import type { Dashboard } from '@/domain/config/dashboard';
import type { CredentialSecret } from '@/storage/credentialStore';

import type { Share } from '../envelope';
import {
  type ImportMode,
  type ImportPlan,
  planImport,
  type SameIdChoice,
} from '../importPlan';
import {
  allAnswered,
  type SecretAnswer,
  type SecretQuestion,
  secretQuestions,
  withAnswers,
} from '../secretQuestions';
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
  /** The credentials whose secret differs from this device's. */
  questions: readonly SecretQuestion[];
  answerOf: (id: string) => SecretAnswer | undefined;
  setAnswer: (id: string, answer: SecretAnswer) => void;
  /** Is a question still unanswered? */
  asking: boolean;
  /** How many times *Import* has stopped to ask. */
  asked: number;
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
  /** The secret this device holds for a credential id. */
  held: (id: string) => CredentialSecret | undefined,
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
  const [answers, setAnswers] = useState<Record<string, SecretAnswer>>({});
  // The encrypted secrets, once the passphrase has opened them.
  const [opened, setOpened] = useState<ShareSecrets | null>(null);
  const [asked, setAsked] = useState(0);

  const chosen = share.dashboards.filter((d) => selected.has(d.id));
  const here = new Set(existing.map((d) => d.id));
  const importing = carried && withCredentials;
  const asksPassphrase = importing && share.credentials.kind === 'encrypted';
  const c = share.credentials;
  const planWith = (secrets: ShareSecrets | null) =>
    planImport(existing, { dashboards: chosen, mode, sameId, secrets });
  // The secrets known without a passphrase step still to take.
  const known = !importing ? null : c.kind === 'plain' ? c.secrets : opened;
  const questions = known ? secretQuestions(planWith(known).secrets, held) : [];
  const asking = !allAnswered(questions, answers);

  /** The share's secrets as chosen, or a message why not. */
  const secrets = async (): Promise<ShareSecrets | null | string> => {
    if (!importing || c.kind === 'none') return null;
    if (c.kind === 'plain') return c.secrets;
    if (opened) return opened;
    const got = await decryptSecrets(c.block, passphrase);
    if (got.ok) {
      setOpened(got.secrets);
      return got.secrets;
    }
    return got.reason === 'wrongPassphrase'
      ? WRONG_PASSPHRASE
      : DAMAGED_CREDENTIALS;
  };

  /** Drop the questions and their answers (the secrets compared changed). */
  const unask = () => {
    setError(null);
    setOpened(null);
    setAnswers({});
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
      const planned = planWith(got);
      const asks = secretQuestions(planned.secrets, held);
      if (!allAnswered(asks, answers)) {
        setAsked((n) => n + 1);
        return null;
      }
      return withAnswers(planned, asks, answers);
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
      unask();
      setWithCredentials(on);
    },
    asksPassphrase,
    passphrase,
    setPassphrase: (text) => {
      unask();
      setPassphrase(text);
    },
    remember,
    setRemember,
    questions,
    answerOf: (id) => answers[id],
    setAnswer: (id, answer) => {
      setAnswers((a) => ({ ...a, [id]: answer }));
    },
    asking,
    asked,
    error,
    setError,
    busy,
    ready:
      chosen.length > 0 &&
      !busy &&
      !(asksPassphrase && passphrase === '') &&
      !asking,
    plan,
  };
}
