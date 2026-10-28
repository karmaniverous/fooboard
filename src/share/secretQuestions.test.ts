/**
 * Tests for the import's questions about secrets (spec.md §3.8, Decision
 * 70): asked only where the share's secret differs from the one this
 * device holds; answers to questions no longer asked count for nothing.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import type { CredentialSecret } from '@/storage/credentialStore';
import { shareBoard } from '@/test/shareBoard';

import type { ImportPlan } from './importPlan';
import {
  allAnswered,
  sameSecret,
  secretQuestions,
  withAnswers,
} from './secretQuestions';

const mine = { kind: 'github', token: 'ghp_mine' } as const;
const theirs = { kind: 'github', token: 'ghp_theirs' } as const;
const aws = {
  kind: 'aws',
  accessKeyId: 'AKIAEXAMPLE',
  secretAccessKey: 'theirs',
} as const;
const secrets: ImportPlan['secrets'] = [
  { id: 'gh-org', label: 'Northwind org', secret: theirs },
  { id: 'aws-prod', label: 'Prod account', secret: aws },
];
const holding =
  (held: Record<string, CredentialSecret>) =>
  (id: string): CredentialSecret | undefined =>
    held[id];
const plan: ImportPlan = {
  dashboards: [shareBoard()],
  secrets,
  forget: [],
  removed: [],
  imported: ['northwind'],
};

describe('sameSecret', () => {
  it.each([
    ['nothing held', undefined, false],
    ['the same token', { ...theirs }, true],
    ['another token', mine, false],
    ['another kind', aws, false],
  ] as const)('%s', (_, held, same) => {
    expect(sameSecret(held, theirs)).toBe(same);
  });

  it('ignores key order', () => {
    expect(
      sameSecret(
        { secretAccessKey: 'theirs', accessKeyId: 'AKIAEXAMPLE', kind: 'aws' },
        aws,
      ),
    ).toBe(true);
  });
});

describe('secretQuestions', () => {
  it('asks only where this device holds a different secret', () => {
    expect(
      secretQuestions(
        secrets,
        holding({ 'gh-org': mine, 'aws-prod': { ...aws } }),
      ),
    ).toEqual([{ id: 'gh-org', kind: 'github', label: 'Northwind org' }]);
  });

  it('asks nothing for credentials this device does not hold', () => {
    expect(secretQuestions(secrets, holding({}))).toEqual([]);
  });

  it('asks once per credential, in the plan order', () => {
    expect(
      secretQuestions(
        secrets,
        holding({
          'gh-org': mine,
          'aws-prod': { ...aws, secretAccessKey: 'mine' },
        }),
      ).map((q) => `${q.kind}:${q.label}`),
    ).toEqual(['github:Northwind org', 'aws:Prod account']);
  });
});

describe('allAnswered', () => {
  const questions = secretQuestions(secrets, holding({ 'gh-org': mine }));
  it.each([
    ['no answer', {}, false],
    ['an answer', { 'gh-org': 'mine' }, true],
    ['an answer to another', { 'aws-prod': 'theirs' }, false],
  ] as const)('%s', (_, answers, all) => {
    expect(allAnswered(questions, answers)).toBe(all);
  });
});

describe('withAnswers', () => {
  const questions = secretQuestions(secrets, holding({ 'gh-org': mine }));

  it('drops the secrets kept as yours, and only those', () => {
    expect(
      withAnswers(plan, questions, { 'gh-org': 'mine' }).secrets.map(
        (s) => s.id,
      ),
    ).toEqual(['aws-prod']);
  });

  it("keeps the share's secret when chosen", () => {
    expect(
      withAnswers(plan, questions, { 'gh-org': 'theirs' }).secrets,
    ).toEqual(secrets);
  });

  it('counts an answer to a question no longer asked for nothing', () => {
    expect(
      withAnswers(plan, questions, { 'aws-prod': 'mine' }).secrets,
    ).toEqual(secrets);
  });
});
