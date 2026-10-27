/**
 * For first-run tests (spec.md §3.9): a simulated GitHub account whose
 * repos have environment, preview and feature branches, answering the
 * page's `fetch` (the real credential providers read through it), and the
 * dashboard a run saved. `renderFirstRun` renders the app's routes.
 *
 * @module
 */
import { vi } from 'vitest';

import { MINUTE } from '@/demo/scenarios/pipeline';
import type { DemoScenario } from '@/demo/sim/scenario';
import { createSimulator } from '@/demo/sim/simulator';
import type { Dashboard } from '@/domain/config/dashboard';
import type { AppStores } from '@/storage';
import { dashboardsOf } from '@/storage/configStore';

import { TINY_TOKEN, tinyScenario, tinyWorkflow } from './simScenario';

/** The simulated token's secret, typed in the token step. */
export const FIRST_RUN_TOKEN = TINY_TOKEN;

const branch = (name: string) => ({
  name,
  commitsEveryMs: [10 * MINUTE, 20 * MINUTE] as [number, number],
});

/** Repos with dev, main and preview branches, and a feature branch whose
 * runs no stage takes (they show as unmapped). */
const firstRunScenario = tinyScenario({
  github: {
    tokens: [
      {
        id: 'gh',
        secret: TINY_TOKEN,
        repos: ['acme/api', 'acme/web', 'acme/docs', 'acme/legacy'],
      },
    ],
    repos: [
      {
        fullName: 'acme/api',
        branches: [
          'dev',
          'main',
          'preview/bali',
          'preview/texas',
          'feature/login',
        ].map(branch),
        workflows: [
          { ...tinyWorkflow, on: ['dev', 'main', 'preview/*', 'feature/*'] },
        ],
      },
      {
        fullName: 'acme/web',
        branches: ['dev', 'main', 'preview/bali'].map(branch),
        workflows: [{ ...tinyWorkflow, on: ['dev', 'main', 'preview/*'] }],
      },
      { fullName: 'acme/docs', branches: [branch('main')] },
      { fullName: 'acme/legacy', branches: [{ name: 'trunk' }] },
    ],
  },
});

/** The account with a token that sees no repos. */
export const noReposScenario = tinyScenario({
  github: {
    tokens: [{ id: 'gh', secret: TINY_TOKEN, repos: [] }],
    repos: [],
  },
});

/** The simulated account's `fetch`. */
export const simulatedFetch = (
  scenario: DemoScenario = firstRunScenario,
): typeof fetch =>
  createSimulator(scenario, { wait: () => Promise.resolve() }).fetch;

/** Answer the page's `fetch` from the simulated account. */
export function stubSimulatedGitHub(
  scenario: DemoScenario = firstRunScenario,
): void {
  vi.stubGlobal('fetch', simulatedFetch(scenario));
}

/** The one saved dashboard. */
export function savedDashboard(stores: AppStores): Dashboard {
  const only = dashboardsOf(stores.config.load()).at(0);
  if (!only) throw new Error('no dashboard saved');
  return only;
}
