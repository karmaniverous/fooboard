/**
 * Tests for a share's secrets (spec.md §3.8 *Encryption parameters*): the
 * passphrase round trip, a wrong passphrase, the iterations, salt and IV
 * read from the share itself, a fresh salt and IV per export, and
 * decrypted content that isn't a secrets object.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import {
  decryptSecrets,
  type EncryptedCredentials,
  EncryptedCredentialsSchema,
  encryptSecrets,
  fromBase64Url,
  SHARE_CIPHER,
  SHARE_IV_BYTES,
  SHARE_KDF,
  SHARE_KEY_BITS,
  SHARE_MAX_ITERATIONS,
  SHARE_PBKDF2_ITERATIONS,
  SHARE_SALT_BYTES,
  type ShareSecrets,
  toBase64Url,
} from './secrets';

/** Few iterations keep the tests fast; the default has its own test. */
const FAST = 1_000;

const secrets: ShareSecrets = {
  'cred-gh': { kind: 'github', token: 'ghp_example' },
  'cred-aws': {
    kind: 'aws',
    accessKeyId: 'AKIAEXAMPLE',
    secretAccessKey: 'wJalrEXAMPLE',
  },
};

/** `plain` encrypted as `block` says, with WebCrypto directly. */
async function sealAs(
  block: EncryptedCredentials,
  passphrase: string,
  plain: string,
): Promise<EncryptedCredentials> {
  const base = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: fromBase64Url(block.salt),
      iterations: block.iterations,
    },
    base,
    { name: 'AES-GCM', length: SHARE_KEY_BITS },
    false,
    ['encrypt'],
  );
  const data = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: fromBase64Url(block.iv) },
    key,
    new TextEncoder().encode(plain),
  );
  return { ...block, data: toBase64Url(new Uint8Array(data)) };
}

describe('share secrets', () => {
  it('round-trips through a passphrase, and only that passphrase', async () => {
    const block = await encryptSecrets(secrets, 'correct horse', FAST);
    expect(JSON.stringify(block)).not.toContain('ghp_example');
    expect(EncryptedCredentialsSchema.parse(block)).toEqual(block);
    expect(await decryptSecrets(block, 'correct horse')).toEqual({
      ok: true,
      secrets,
    });
    expect(await decryptSecrets(block, 'correct hors')).toEqual({
      ok: false,
      reason: 'wrongPassphrase',
    });
  });

  it('records 600,000 iterations by default, and opens with them', async () => {
    const block = await encryptSecrets(secrets, 'pass');
    expect(block).toMatchObject({
      kdf: 'PBKDF2-SHA256',
      cipher: 'AES-GCM',
      iterations: SHARE_PBKDF2_ITERATIONS,
    });
    // The approved parameters (spec.md §3.8), pinned.
    expect([
      SHARE_KDF,
      SHARE_PBKDF2_ITERATIONS,
      SHARE_CIPHER,
      SHARE_KEY_BITS,
      SHARE_SALT_BYTES,
      SHARE_IV_BYTES,
    ]).toEqual(['PBKDF2-SHA256', 600_000, 'AES-GCM', 256, 16, 12]);
    expect(fromBase64Url(block.salt)).toHaveLength(SHARE_SALT_BYTES);
    expect(fromBase64Url(block.iv)).toHaveLength(SHARE_IV_BYTES);
    expect(await decryptSecrets(block, 'pass')).toMatchObject({ ok: true });
  });

  it('reads the iterations, salt and IV from the share', async () => {
    const block = await encryptSecrets(secrets, 'pass', FAST + 1);
    expect(await decryptSecrets(block, 'pass')).toMatchObject({ ok: true });
    const other = await encryptSecrets(secrets, 'pass', FAST + 1);
    for (const field of ['salt', 'iv'] as const) {
      expect(
        await decryptSecrets({ ...block, [field]: other[field] }, 'pass'),
      ).toEqual({ ok: false, reason: 'wrongPassphrase' });
    }
    expect(
      await decryptSecrets({ ...block, iterations: FAST }, 'pass'),
    ).toEqual({ ok: false, reason: 'wrongPassphrase' });
  });

  it('uses a fresh salt and IV for every export', async () => {
    const a = await encryptSecrets(secrets, 'pass', FAST);
    const b = await encryptSecrets(secrets, 'pass', FAST);
    expect(a.salt).not.toBe(b.salt);
    expect(a.iv).not.toBe(b.iv);
    expect(a.data).not.toBe(b.data);
  });

  it('refuses altered ciphertext as it does a wrong passphrase', async () => {
    const block = await encryptSecrets(secrets, 'pass', FAST);
    const bytes = fromBase64Url(block.data);
    bytes[0] ^= 1;
    expect(
      await decryptSecrets({ ...block, data: toBase64Url(bytes) }, 'pass'),
    ).toEqual({ ok: false, reason: 'wrongPassphrase' });
  });

  it.each([
    ['not JSON', 'not json'],
    ['not secrets', JSON.stringify({ x: { kind: 'github', token: '' } })],
  ])('calls opened content that is %s damaged', async (_, plain) => {
    const block = await sealAs(
      await encryptSecrets({}, 'pass', FAST),
      'pass',
      plain,
    );
    expect(await decryptSecrets(block, 'pass')).toEqual({
      ok: false,
      reason: 'damaged',
    });
  });

  it('refuses a share asking for more iterations than an import runs', async () => {
    const block = await encryptSecrets(secrets, 'pass', FAST);
    expect(
      EncryptedCredentialsSchema.safeParse({
        ...block,
        iterations: SHARE_MAX_ITERATIONS + 1,
      }).success,
    ).toBe(false);
    expect(
      EncryptedCredentialsSchema.safeParse({ ...block, iterations: 0 }).success,
    ).toBe(false);
  });

  it('writes base64url without padding, and reads it back', () => {
    const bytes = Uint8Array.from([251, 255, 191, 0, 62]);
    const text = toBase64Url(bytes);
    expect(text).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(fromBase64Url(text)).toEqual(bytes);
  });
});
