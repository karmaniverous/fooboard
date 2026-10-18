/**
 * Tests for the engine's token budgets (spec.md C-16): a battery slot for
 * every GitHub token from the start, filled when the budget is read.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { demoDashboard } from '@/demo/board';

import { demoProviders } from './demoProviders';
import { createBoardEngine } from './engine';
import { type Visibility } from './scheduler';

const visible: Visibility = { isHidden: () => false, onChange: () => () => {} };

describe('board engine budgets', () => {
  it('has a battery slot for every token from the start, then reads it', async () => {
    const engine = createBoardEngine({
      dashboard: demoDashboard,
      providers: demoProviders(() => 0),
      visibility: visible,
    });
    expect(engine.getModel().budgets).toEqual({ 'demo-github': undefined });
    await engine.refreshAll();
    expect(engine.getModel().budgets['demo-github']?.remaining).toBe(4870);
  });
});
