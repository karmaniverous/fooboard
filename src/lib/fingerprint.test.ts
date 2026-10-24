/**
 * Tests for a secret's fingerprint (spec.md §3.1, §3.4): the same for the
 * same secret, different for another, and holding nothing of the secret.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { fingerprintOf } from './fingerprint';

const token = { kind: 'github', token: 'ghp_secret_value' };

describe('fingerprintOf', () => {
  it('is the SHA-256 digest of the secret, holding nothing of it', () => {
    const fingerprint = fingerprintOf(token);
    expect(fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(fingerprint).not.toContain('ghp_');
    expect(fingerprintOf({ ...token })).toBe(fingerprint);
    expect(fingerprintOf({ ...token, token: 'ghp_secret_valuf' })).not.toBe(
      fingerprint,
    );
  });

  it('is undefined without a secret', () => {
    expect(fingerprintOf(undefined)).toBeUndefined();
  });
});
