/**
 * Tests for *Copy problems for your assistant* (spec 0.2.0 §3.J *Problems
 * after a valid import*): the Problems panel offers it while any of the
 * configuration's own problems is listed, and it copies their messages
 * after the preamble; problems found while reading are not the share's,
 * so `useProblems` keeps them out of what is copied, as it keeps out
 * what was dismissed.
 *
 * @module
 */
import { act, render, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { DashboardSchema } from '@/domain/config/dashboard';
import { branchRules } from '@/domain/config/placement';
import { problem } from '@/domain/problems/problem';
import { configProblems } from '@/domain/problems/problems';
import { createAppStores } from '@/storage';
import { memoryStorage } from '@/storage/keyValue';
import { StoresContext } from '@/storage/storesContext';
import { clickToCopy, mockClipboard, unmockClipboard } from '@/test/clipboard';

import {
  COPY_PROBLEMS,
  PROBLEMS_PREAMBLE,
  ProblemsPanel,
} from './ProblemsPanel';
import { useProblems } from './useProblems';

/** A board whose second stage has no rule: a configuration problem. */
const dashboard = DashboardSchema.parse({
  id: 'd',
  name: 'd',
  stages: [
    { id: 'dev', name: 'Dev', rules: branchRules('dev') },
    { id: 'prod', name: 'Prod', rules: {} },
  ],
  rows: [{ type: 'github', id: 'web', repo: 'a/web', displayName: 'Web' }],
});
const config = configProblems(dashboard);
const runtime = problem({ kind: 'row', id: 'web' }, 'read more', true);

afterEach(unmockClipboard);

describe('Copy problems for your assistant', () => {
  it("copies the configuration's problems after the preamble", async () => {
    expect(config.length).toBeGreaterThan(0);
    const writeText = mockClipboard();
    render(
      <ProblemsPanel
        dashboard={dashboard}
        problems={[...config, runtime]}
        copyable={config}
        onFix={() => undefined}
        onDismiss={() => undefined}
      />,
    );
    await clickToCopy(screen.getByRole('button', { name: COPY_PROBLEMS }));
    expect(writeText).toHaveBeenCalledWith(
      [PROBLEMS_PREAMBLE, ...config.map((p) => p.message)].join('\n'),
    );
  });

  it("is not offered when none of the listed problems is the configuration's", () => {
    render(
      <ProblemsPanel
        dashboard={dashboard}
        problems={[runtime]}
        onFix={() => undefined}
        onDismiss={() => undefined}
      />,
    );
    expect(screen.queryByRole('button', { name: COPY_PROBLEMS })).toBeNull();
  });
});

describe('useProblems', () => {
  const stores = createAppStores(memoryStorage());
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <StoresContext value={stores}>{children}</StoresContext>
  );

  it("lists the configuration's problems apart, without reading problems or dismissed ones", () => {
    const { result } = renderHook(
      () => useProblems(dashboard, { problems: [runtime] }),
      { wrapper },
    );
    expect(result.current.config).toEqual(config);
    expect(result.current.shown).toEqual([...config, runtime]);
    const [first] = config;
    act(() => {
      result.current.dismiss(first.id);
    });
    expect(result.current.config).toEqual(config.slice(1));
    expect(result.current.shown).toEqual([...config.slice(1), runtime]);
  });
});
