import { describe, expect, it } from 'vitest';

import { demoProviders } from '@/engine';
import type { EngineProviders } from '@/engine/types';

import { type Around, type RequestCall, wrapProviders } from './readerWrap';

/** An `around` that records each call and passes it through. */
function recording(): { around: Around; calls: RequestCall[] } {
  const calls: RequestCall[] = [];
  return {
    calls,
    around: (call, run) => {
      calls.push(call);
      return run();
    },
  };
}

const ref = { owner: 'acme', repo: 'api-core' };

/** Fresh readers a factory hands out in the fresh-reader case. */
const FRESH_READERS = 50;

describe('wrapProviders', () => {
  it('passes GitHub reads through unchanged, describing each request', async () => {
    const inner = demoProviders(() => 0);
    const { around, calls } = recording();
    const reader = wrapProviders(inner, around).github('tok');
    const plain = inner.github('tok');
    if (!reader || !plain) throw new Error('demo reader');

    expect(await reader.listWorkflowRuns(ref)).toEqual(
      await plain.listWorkflowRuns(ref),
    );
    await reader.listRunJobs(ref, 1000);
    await reader.listBranches(ref);
    await reader.compare(ref, 'dev', 'main');
    await reader.matchingRefs(ref, 'preview/');
    await reader.listRepos();
    await reader.readRateLimit();
    // Synchronous reads aren't requests.
    expect(reader.getBudget()).toEqual(plain.getBudget());
    expect(reader.getTokenExpiration()).toBeUndefined();

    expect(calls.map((c) => c.kind)).toEqual([
      'listWorkflowRuns',
      'listRunJobs',
      'listBranches',
      'compare',
      'matchingRefs',
      'listRepos',
      'readRateLimit',
    ]);
    expect(calls[0]).toEqual({
      provider: 'github',
      kind: 'listWorkflowRuns',
      credentialId: 'tok',
      repo: 'acme/api-core',
    });
    expect(calls.at(-1)).toEqual({
      provider: 'github',
      kind: 'readRateLimit',
      credentialId: 'tok',
    });
  });

  it('passes Amplify reads through, naming the credential, region and app', async () => {
    const { around, calls } = recording();
    const readerFor = wrapProviders(
      demoProviders(() => 0),
      around,
    ).amplify('key');
    if (!readerFor) throw new Error('demo reader');
    const reader = readerFor({ credentialId: 'key', region: 'us-east-1' });
    const branches = await reader.listBranches('d1demomarketing');
    expect(branches.length).toBeGreaterThan(0);
    await reader.listJobs('d1demomarketing', 'dev', 5);
    await reader.listApps();
    await reader.getJob('d1demomarketing', 'dev', '1');
    expect(calls).toEqual([
      {
        provider: 'amplify',
        kind: 'listBranches',
        credentialId: 'key',
        region: 'us-east-1',
        appId: 'd1demomarketing',
      },
      expect.objectContaining({ kind: 'listJobs', appId: 'd1demomarketing' }),
      {
        provider: 'amplify',
        kind: 'listApps',
        credentialId: 'key',
        region: 'us-east-1',
      },
      expect.objectContaining({ kind: 'getJob' }),
    ]);
  });

  it('keeps a missing credential missing and a reader stable', () => {
    const none: EngineProviders = {
      github: () => undefined,
      amplify: () => undefined,
    };
    const { around } = recording();
    const wrappedNone = wrapProviders(none, around);
    expect(wrappedNone.github('x')).toBeUndefined();
    expect(wrappedNone.amplify('x')).toBeUndefined();

    const wrapped = wrapProviders(
      demoProviders(() => 0),
      around,
    );
    expect(wrapped.github('a')).toBe(wrapped.github('a'));

    // One inner Amplify reader per source: one wrapped reader for it.
    const inner = demoProviders(() => 0);
    const innerFor = inner.amplify('k');
    if (!innerFor) throw new Error('demo reader');
    const fixed = new Map(
      ['us-east-1', 'eu-west-1'].map((region) => [
        region,
        innerFor({ credentialId: 'k', region }),
      ]),
    );
    const stable: EngineProviders = {
      ...inner,
      amplify: () => (source) => fixed.get(source.region) ?? innerFor(source),
    };
    const forKey = wrapProviders(stable, around).amplify('k');
    const east = { credentialId: 'k', region: 'us-east-1' };
    expect(forKey?.(east)).toBe(forKey?.(east));
    expect(forKey?.(east)).not.toBe(
      forKey?.({ credentialId: 'k', region: 'eu-west-1' }),
    );
  });

  it('wraps each fresh reader a factory returns, once per reader', async () => {
    // The demo's factory returns a fresh Amplify reader on every lookup:
    // each gets its own wrapper, and a reader looked up again keeps its own.
    const inner = demoProviders(() => 0);
    const innerFor = inner.amplify('k');
    if (!innerFor) throw new Error('demo reader');
    const source = { credentialId: 'k', region: 'us-east-1' };
    const readers = Array.from({ length: FRESH_READERS }, () =>
      innerFor(source),
    );
    let next = 0;
    const replaying: EngineProviders = {
      ...inner,
      amplify: () => () => readers[next++ % readers.length] ?? innerFor(source),
    };
    const { around, calls } = recording();
    const forKey = wrapProviders(replaying, around).amplify('k');
    if (!forKey) throw new Error('demo reader');
    const first = readers.map(() => forKey(source));
    const again = readers.map(() => forKey(source));
    expect(new Set(first).size).toBe(FRESH_READERS);
    again.forEach((wrapped, i) => {
      expect(wrapped).toBe(first[i]);
    });
    // Every wrapper still describes its requests.
    await first[FRESH_READERS - 1]?.listApps();
    expect(calls).toEqual([expect.objectContaining({ kind: 'listApps' })]);
  });

  it('settles as the request does', async () => {
    // The demo's flaky-svc repo answers 502.
    const reader = wrapProviders(
      demoProviders(() => 0),
      recording().around,
    ).github('t');
    await expect(
      reader?.listWorkflowRuns({ owner: 'acme', repo: 'flaky-svc' }),
    ).rejects.toThrow('502');
  });
});
