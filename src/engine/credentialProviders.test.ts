/**
 * Tests for `credentialProviders`: readers exist only for entered secrets
 * of the right kind, are reused until the secret changes, and an AWS key's
 * readers are reused per region.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { createCredentialStore } from '@/storage/credentialStore';
import { memoryStorage } from '@/storage/keyValue';

import { credentialProviders } from './credentialProviders';

const setup = () => {
  const store = createCredentialStore(memoryStorage());
  return { store, providers: credentialProviders(store) };
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
    store.set('gh', { kind: 'github', token: 'b' }, false);
    expect(providers.github('gh')).not.toBe(first);
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
