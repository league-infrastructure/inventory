import crypto from 'crypto';

/**
 * Encrypts/decrypts API token plaintext for at-rest storage using
 * AES-256-GCM.
 *
 * Key material: `TOKEN_ENCRYPTION_KEY` env var (32-byte key, hex or
 * base64 encoded) if set, otherwise `sha256(SESSION_SECRET)` — so a
 * production deployment that already sets `SESSION_SECRET` needs no
 * new configuration to get an at-rest-encrypted token store.
 *
 * Blob format: `v1:<iv base64>:<tag base64>:<ciphertext base64>`, with
 * a fresh random 12-byte IV per token.
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const BLOB_VERSION = 'v1';

function resolveKey(): Buffer {
  const explicit = process.env.TOKEN_ENCRYPTION_KEY;
  if (explicit) {
    // Accept hex (64 chars) or base64 (44 chars incl. padding) 32-byte keys.
    const buf = /^[0-9a-fA-F]{64}$/.test(explicit)
      ? Buffer.from(explicit, 'hex')
      : Buffer.from(explicit, 'base64');
    if (buf.length !== 32) {
      throw new Error('TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes (hex or base64)');
    }
    return buf;
  }

  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    throw new Error('Neither TOKEN_ENCRYPTION_KEY nor SESSION_SECRET is set — cannot derive token encryption key');
  }
  return crypto.createHash('sha256').update(sessionSecret).digest();
}

/** Encrypts a raw token value into the `v1:<iv>:<tag>:<ciphertext>` blob format. */
export function encryptToken(raw: string): string {
  const key = resolveKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(raw, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [BLOB_VERSION, iv.toString('base64'), tag.toString('base64'), ciphertext.toString('base64')].join(':');
}

/** Decrypts a blob produced by {@link encryptToken}. Throws on any tamper or format error. */
export function decryptToken(blob: string): string {
  const parts = blob.split(':');
  if (parts.length !== 4 || parts[0] !== BLOB_VERSION) {
    throw new Error('Unrecognized token ciphertext blob format');
  }
  const [, ivB64, tagB64, ciphertextB64] = parts;

  const key = resolveKey();
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const ciphertext = Buffer.from(ciphertextB64, 'base64');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString('utf8');
}
