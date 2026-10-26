/**
 * Secrets in a share (spec.md §3.8 *Share format*, Decisions 39 and 63):
 * the plain secrets object, keyed by credential id, and its passphrase
 * encryption with WebCrypto. PBKDF2 with SHA-256 derives an AES-GCM key
 * from the passphrase; the salt and IV are random per export. Only the
 * secrets are encrypted, so a share's dashboards can be listed before
 * the passphrase is asked for. Decryption reads the iterations, salt and
 * IV from the share itself, so a share made under other constants still
 * opens.
 *
 * @module
 */
import { z } from 'zod';

import { CredentialSecretSchema } from '@/storage/credentialStore';

/** The key derivation, as named in a share. */
export const SHARE_KDF = 'PBKDF2-SHA256';
/** PBKDF2 iterations for a new export (about 0.3 to 0.6 s on a phone,
 * once per import). */
export const SHARE_PBKDF2_ITERATIONS = 600_000;
/** The most iterations an import will run: a share asking for more is
 * refused as damaged rather than left to hang the tab. */
export const SHARE_MAX_ITERATIONS = 10_000_000;
/** Random salt bytes per export. */
export const SHARE_SALT_BYTES = 16;
/** The cipher, as named in a share. */
export const SHARE_CIPHER = 'AES-GCM';
/** The AES-GCM key length. */
export const SHARE_KEY_BITS = 256;
/** Random IV bytes per export. */
export const SHARE_IV_BYTES = 12;

/** Secrets by credential id (never inside a dashboard). */
const ShareSecretsSchema = z.record(z.string().min(1), CredentialSecretSchema);
export type ShareSecrets = z.infer<typeof ShareSecretsSchema>;

/** base64url without padding. */
const Base64UrlSchema = z.string().regex(/^[A-Za-z0-9_-]+$/);

export const PlainCredentialsSchema = z.object({
  encrypted: z.literal(false),
  secrets: ShareSecretsSchema,
});

export const EncryptedCredentialsSchema = z.object({
  encrypted: z.literal(true),
  kdf: z.literal(SHARE_KDF),
  iterations: z.int().min(1).max(SHARE_MAX_ITERATIONS),
  salt: Base64UrlSchema,
  cipher: z.literal(SHARE_CIPHER),
  iv: Base64UrlSchema,
  data: Base64UrlSchema,
});
export type EncryptedCredentials = z.infer<typeof EncryptedCredentialsSchema>;

/** `bytes` as base64url, without padding. */
export function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
}

/** The bytes of a base64url string; throws if it isn't one. */
export function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text.replaceAll('-', '+').replaceAll('_', '/'));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

/** The AES-GCM key for `passphrase`, `salt` and `iterations`. */
async function keyFor(
  passphrase: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
  usage: KeyUsage,
): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    base,
    { name: 'AES-GCM', length: SHARE_KEY_BITS },
    false,
    [usage],
  );
}

/** Random bytes (WebCrypto). */
const randomBytes = (n: number): Uint8Array<ArrayBuffer> =>
  crypto.getRandomValues(new Uint8Array(n));

/** Encrypt `secrets` under `passphrase`, with a fresh salt and IV. */
export async function encryptSecrets(
  secrets: ShareSecrets,
  passphrase: string,
  iterations: number = SHARE_PBKDF2_ITERATIONS,
): Promise<EncryptedCredentials> {
  const salt = randomBytes(SHARE_SALT_BYTES);
  const iv = randomBytes(SHARE_IV_BYTES);
  const key = await keyFor(passphrase, salt, iterations, 'encrypt');
  const data = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(JSON.stringify(secrets)),
  );
  return {
    encrypted: true,
    kdf: SHARE_KDF,
    iterations,
    salt: toBase64Url(salt),
    cipher: SHARE_CIPHER,
    iv: toBase64Url(iv),
    data: toBase64Url(new Uint8Array(data)),
  };
}

/** What decrypting found. */
export type Decrypted =
  | { ok: true; secrets: ShareSecrets }
  /** The passphrase doesn't open them (or the ciphertext was altered:
   * AES-GCM can't tell the two apart). */
  | { ok: false; reason: 'wrongPassphrase' }
  /** They open, but aren't a secrets object. */
  | { ok: false; reason: 'damaged' };

/** Decrypt `block` with `passphrase`, using the block's own iterations,
 * salt and IV. */
export async function decryptSecrets(
  block: EncryptedCredentials,
  passphrase: string,
): Promise<Decrypted> {
  let plain: ArrayBuffer;
  try {
    const key = await keyFor(
      passphrase,
      fromBase64Url(block.salt),
      block.iterations,
      'decrypt',
    );
    plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64Url(block.iv) },
      key,
      fromBase64Url(block.data),
    );
  } catch {
    return { ok: false, reason: 'wrongPassphrase' };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(plain));
  } catch {
    return { ok: false, reason: 'damaged' };
  }
  const secrets = ShareSecretsSchema.safeParse(parsed);
  return secrets.success
    ? { ok: true, secrets: secrets.data }
    : { ok: false, reason: 'damaged' };
}
