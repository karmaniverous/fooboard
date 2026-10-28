/**
 * The import's questions about secrets (spec.md §3.8, Decision 70): one
 * per credential whose secret in the share differs from the one this
 * device holds for it (remembered or this tab's), asking whether to keep
 * this device's or use the share's. Nothing is assumed either way, and
 * neither value is shown. A secret identical to this device's raises no
 * question (the import leaves it where it is), nor does a credential this
 * device doesn't hold yet (simply imported). Credentials are matched by
 * the id the plan stores them under, after any re-id, so a copy (new ids)
 * never asks. Pure: the comparison happens on the device, and nothing
 * here writes.
 *
 * @module
 */
import type { CredentialKind } from '@/domain/config/credentials';
import {
  type CredentialSecret,
  CredentialSecretSchema,
} from '@/storage/credentialStore';

import type { ImportPlan } from './importPlan';

/** *Keep yours* or *use the share's*. */
export type SecretAnswer = 'mine' | 'theirs';

/** The answers so far, by credential id. */
export type SecretAnswers = Readonly<Partial<Record<string, SecretAnswer>>>;

/** A credential whose secret differs, named by its label. */
export interface SecretQuestion {
  id: string;
  kind: CredentialKind;
  label: string;
}

/** Do `a` and `b` hold the same secret? */
export const sameSecret = (
  a: CredentialSecret | undefined,
  b: CredentialSecret,
): boolean =>
  a !== undefined &&
  JSON.stringify(CredentialSecretSchema.parse(a)) ===
    JSON.stringify(CredentialSecretSchema.parse(b));

/** One question per secret `secrets` stores that differs from `held`'s. */
export const secretQuestions = (
  secrets: ImportPlan['secrets'],
  held: (id: string) => CredentialSecret | undefined,
): SecretQuestion[] =>
  secrets.flatMap(({ id, label, secret }) => {
    const mine = held(id);
    return mine === undefined || sameSecret(mine, secret)
      ? []
      : [{ id, kind: secret.kind, label }];
  });

/** Has every one of `questions` an answer? */
export const allAnswered = (
  questions: readonly SecretQuestion[],
  answers: SecretAnswers,
): boolean => questions.every((q) => answers[q.id] !== undefined);

/** `plan` without the secrets whose question was answered *keep yours*
 * (an answer to a question no longer asked counts for nothing). */
export function withAnswers(
  plan: ImportPlan,
  questions: readonly SecretQuestion[],
  answers: SecretAnswers,
): ImportPlan {
  const keep = new Set(
    questions.filter((q) => answers[q.id] === 'mine').map((q) => q.id),
  );
  return { ...plan, secrets: plan.secrets.filter(({ id }) => !keep.has(id)) };
}
