import { describe, it, expect } from 'vitest'
import { encryptValue, decryptValue, isEncrypted } from '../src/lib/config-encryption.js'

describe('config-encryption', () => {
  it('encrypts and decrypts a value round-trip', () => {
    const original = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.test-payload'
    const encrypted = encryptValue(original)
    const decrypted = decryptValue(encrypted)
    expect(decrypted).toBe(original)
  })

  it('produces encrypted value with enc:v1: prefix', () => {
    const encrypted = encryptValue('test-token')
    expect(encrypted.startsWith('enc:v1:')).toBe(true)
  })

  it('detects encrypted values', () => {
    expect(isEncrypted('enc:v1:abc123')).toBe(true)
    expect(isEncrypted('plaintext-token')).toBe(false)
    expect(isEncrypted('')).toBe(false)
  })

  it('decrypts legacy plaintext values transparently', () => {
    const plaintext = 'legacy-jwt-token'
    expect(decryptValue(plaintext)).toBe(plaintext)
  })

  it('produces different ciphertexts for the same input (random IV)', () => {
    const original = 'test-token'
    const enc1 = encryptValue(original)
    const enc2 = encryptValue(original)
    expect(enc1).not.toBe(enc2)
    expect(decryptValue(enc1)).toBe(original)
    expect(decryptValue(enc2)).toBe(original)
  })

  it('rejects tampered ciphertext', () => {
    const encrypted = encryptValue('test-token')
    // Flip a character in the base64 payload to corrupt the ciphertext
    const payload = encrypted.slice('enc:v1:'.length)
    const buf = Buffer.from(payload, 'base64')
    buf[buf.length - 1] ^= 0xff
    const tampered = 'enc:v1:' + buf.toString('base64')
    expect(() => decryptValue(tampered)).toThrow()
  })

  it('handles empty string encryption', () => {
    const encrypted = encryptValue('')
    expect(isEncrypted(encrypted)).toBe(true)
    expect(decryptValue(encrypted)).toBe('')
  })

  it('handles long token encryption', () => {
    const longToken = 'x'.repeat(4096)
    const encrypted = encryptValue(longToken)
    expect(decryptValue(encrypted)).toBe(longToken)
  })
})
