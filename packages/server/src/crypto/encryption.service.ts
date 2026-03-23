import { Injectable, InternalServerErrorException } from '@nestjs/common'
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { AppConfigService } from '../config/app-config.service'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const TAG_LENGTH = 16

@Injectable()
export class EncryptionService {
  constructor(private readonly appConfig: AppConfigService) {}

  private getKey(): Buffer {
    return Buffer.from(this.appConfig.encryptionKey, 'hex')
  }

  encrypt(config: object): string {
    const key = this.getKey()
    const iv = randomBytes(IV_LENGTH)
    const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH })

    const plaintext = JSON.stringify(config)
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
    const tag = cipher.getAuthTag()

    const combined = Buffer.concat([iv, tag, encrypted])
    return combined.toString('base64url')
  }

  decrypt(encoded: string): object {
    const key = this.getKey()
    const combined = Buffer.from(encoded, 'base64url')

    const iv = combined.subarray(0, IV_LENGTH)
    const tag = combined.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
    const ciphertext = combined.subarray(IV_LENGTH + TAG_LENGTH)

    const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH })
    decipher.setAuthTag(tag)

    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])
    try {
      return JSON.parse(decrypted.toString('utf8')) as object
    } catch {
      throw new InternalServerErrorException('Failed to decrypt auth configuration — data may be corrupted')
    }
  }
}
