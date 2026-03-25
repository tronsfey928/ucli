/**
 * Config value encryption utilities.
 *
 * Encrypts sensitive config values (e.g., JWT tokens) at rest using AES-256-GCM
 * with a machine-specific derived key. This ensures credentials are never stored
 * in plaintext on disk.
 *
 * Key derivation: PBKDF2(username + hostname, static-salt, 100k iterations, SHA-512)
 * Format: "enc:v1:<base64(iv + authTag + ciphertext)>"
 */
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  pbkdf2Sync,
  createHash,
} from 'node:crypto'
import { hostname, userInfo } from 'node:os'

const ENC_PREFIX = 'enc:v1:'
const ALGORITHM = 'aes-256-gcm'
const IV_LEN = 12
const TAG_LEN = 16
const PBKDF2_ITERATIONS = 100_000

/** Derive a 256-bit key from machine-specific identity (username + hostname). */
function deriveKey(): Buffer {
  let user = 'default'
  try {
    user = userInfo().username
  } catch {
    // userInfo() may throw on some platforms (e.g., certain containers)
  }
  const material = `ucli:${user}@${hostname()}`
  const salt = createHash('sha256').update('ucli-config-salt-v1').digest()
  return pbkdf2Sync(material, salt, PBKDF2_ITERATIONS, 32, 'sha512')
}

/** Encrypt a plaintext string. Returns prefixed ciphertext string. */
export function encryptValue(plaintext: string): string {
  const key = deriveKey()
  const iv = randomBytes(IV_LEN)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  const packed = Buffer.concat([iv, tag, encrypted])
  return ENC_PREFIX + packed.toString('base64')
}

/**
 * Decrypt a stored value. If the value has the encryption prefix, it is
 * decrypted; otherwise it is returned as-is for backward compatibility
 * with legacy plaintext configs.
 */
export function decryptValue(stored: string): string {
  if (!stored.startsWith(ENC_PREFIX)) {
    return stored
  }
  const key = deriveKey()
  const packed = Buffer.from(stored.slice(ENC_PREFIX.length), 'base64')
  const iv = packed.subarray(0, IV_LEN)
  const tag = packed.subarray(IV_LEN, IV_LEN + TAG_LEN)
  const encrypted = packed.subarray(IV_LEN + TAG_LEN)
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}

/** Check whether a stored value is encrypted (has the encryption prefix). */
export function isEncrypted(value: string): boolean {
  return value.startsWith(ENC_PREFIX)
}
