import Conf from 'conf'
import { homedir } from 'node:os'
import { join, dirname } from 'node:path'
import { chmodSync, mkdirSync } from 'node:fs'
import { encryptValue, decryptValue, isEncrypted } from './lib/config-encryption.js'

export interface CLIConfig {
  serverUrl: string
  token: string
}

const conf = new Conf<CLIConfig>({
  projectName: 'ucli',
  schema: {
    serverUrl: { type: 'string' },
    token: { type: 'string' },
  },
})

export const cacheDir = join(homedir(), '.cache', 'ucli')

/** Ensure the config file and its directory have restrictive permissions. */
function hardenConfigPermissions(): void {
  try {
    const configPath = conf.path
    const configDir = dirname(configPath)
    mkdirSync(configDir, { recursive: true, mode: 0o700 })
    chmodSync(configDir, 0o700)
    chmodSync(configPath, 0o600)
  } catch {
    // Permission enforcement may fail on some platforms (e.g., Windows)
    console.warn('Warning: Could not enforce restrictive file permissions on config. Token is encrypted but file permissions may be permissive.')
  }
}

export function getConfig(): CLIConfig {
  const serverUrl = conf.get('serverUrl')
  const rawToken = conf.get('token')

  if (!serverUrl || !rawToken) {
    console.error('ucli is not configured. Run: ucli configure --server <url> --token <jwt>')
    process.exit(1)
  }

  const token = decryptValue(rawToken)

  // Auto-migrate: re-encrypt legacy plaintext tokens on read
  if (!isEncrypted(rawToken)) {
    conf.set('token', encryptValue(token))
    hardenConfigPermissions()
  }

  return { serverUrl, token }
}

export function saveConfig(cfg: CLIConfig): void {
  conf.set('serverUrl', cfg.serverUrl)
  conf.set('token', encryptValue(cfg.token))
  hardenConfigPermissions()
}

export function isConfigured(): boolean {
  return Boolean(conf.get('serverUrl') && conf.get('token'))
}
