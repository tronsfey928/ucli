import { Injectable } from '@nestjs/common'
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { AppConfigService } from '../config/app-config.service'
import type { AuthConfig } from '../storage/interfaces/repos.interface'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const TAG_LENGTH = 16

@Injectable()
export class EncryptionService {
  constructor(private readonly appConfig: AppConfigService) {}

  private getKey(): Buffer {
    return Buffer.from(this.appConfig.encryptionKey, 'hex')
  }

  encrypt(authConfig: AuthConfig): string {
    const key = this.getKey()
    const iv = randomBytes(IV_LENGTH)
    const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH })

    const plaintext = JSON.stringify(authConfig)
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
    const tag = cipher.getAuthTag()

    const combined = Buffer.concat([iv, tag, encrypted])
    return combined.toString('base64url')
  }

  decrypt(encoded: string): AuthConfig {
    const key = this.getKey()
    const combined = Buffer.from(encoded, 'base64url')

    const iv = combined.subarray(0, IV_LENGTH)
    const tag = combined.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
    const ciphertext = combined.subarray(IV_LENGTH + TAG_LENGTH)

    const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH })
    decipher.setAuthTag(tag)

    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])
    return JSON.parse(decrypted.toString('utf8')) as AuthConfig
  }
}
