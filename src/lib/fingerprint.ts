/**
 * A secret's fingerprint (spec.md §3.1, §3.4): the SHA-256 digest of the
 * secret, in hex. It changes whenever the secret does, and the secret
 * can't be recovered from it, so it can go where the secret never may:
 * a GitHub budget report is tagged with the fingerprint of the token that
 * read it (fooboard#24), and so is every query's data, in memory and in
 * the persisted cache (Decision 27).
 *
 * @module
 */
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';

/** The fingerprint of `secret` (`undefined` when there is none). */
export const fingerprintOf = (
  secret: object | undefined,
): string | undefined =>
  secret ? bytesToHex(sha256(utf8ToBytes(JSON.stringify(secret)))) : undefined;
