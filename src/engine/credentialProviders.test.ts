/**
 * Tests for `credentialProviders`: readers exist only for entered secrets
 * of the right kind, are reused until the secret changes (the fingerprint
 * changes with it), an AWS key's readers are reused per region, and a
 * GitHub response's budget is reported under its credential.
 *
 * @module
 */
import { describe, expect, it, vi } from 'vitest';

import { createCredentialStore } from '@/storage/credentialStore';
import { memoryStorage } from '@/storage/keyValue';

import { credentialProviders } from './credentialProviders';

const setup = () => {
  const store = createCredentialStore(memoryStorage());
  const onBudget = vi.fn();
  return {
    store,
    onBudget,
    providers: credentialProviders(store, { onBudget }),
  };
};

describe('credentialProviders', () => {
  it('has no reader for a missing or wrong-kind secret', () => {
    const { store, providers } = setup();
    expect(providers.github('gh')).toBeUndefined();
    store.set(
      'aws',
      { kind: 'aws', accessKeyId: 'k', secretAccessKey: 's' },
      false,
    );
    expect(providers.github('aws')).toBeUndefined();
    expect(providers.amplify('aws')).toBeDefined();
  });

  it('reuses a GitHub reader until its token changes', () => {
    const { store, providers } = setup();
    store.set('gh', { kind: 'github', token: 'a' }, false);
    const first = providers.github('gh');
    expect(providers.github('gh')).toBe(first);
    const before = providers.fingerprint('gh');
    store.set('gh', { kind: 'github', token: 'b' }, false);
    expect(providers.github('gh')).not.toBe(first);
    expect(providers.fingerprint('gh')).not.toBe(before);
    expect(providers.fingerprint('none')).toBeUndefined();
  });

  it("reports a response's budget under its credential", async () => {
    const { store, onBudget, providers } = setup();
    store.set('gh', { kind: 'github', token: 'a' }, false);
    const headers = {
      'x-ratelimit-limit': '5000',
      'x-ratelimit-remaining': '4000',
      'x-ratelimit-reset': '1',
      'x-ratelimit-used': '1000',
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ total_count: 0, workflow_runs: [] }), {
            headers,
          }),
        ),
      ),
    );
    try {
      await providers.github('gh')?.runsPage({ owner: 'o', repo: 'r' }, 1);
    } finally {
      vi.unstubAllGlobals();
    }
    expect(onBudget).toHaveBeenCalledWith(
      'gh',
      expect.objectContaining({ remaining: 4000 }),
    );
  });

  it('reuses an AWS key reader per region', () => {
    const { store, providers } = setup();
    store.set(
      'aws',
      { kind: 'aws', accessKeyId: 'k', secretAccessKey: 's' },
      false,
    );
    const readerFor = providers.amplify('aws');
    const source = { credentialId: 'aws', region: 'us-east-1' };
    expect(readerFor?.(source)).toBe(readerFor?.(source));
    expect(readerFor?.(source)).not.toBe(
      readerFor?.({ ...source, region: 'eu-west-1' }),
    );
  });
});
