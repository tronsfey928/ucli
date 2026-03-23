import Conf from 'conf'
import { homedir } from 'node:os'
import { join } from 'node:path'

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

export function getConfig(): CLIConfig {
  const serverUrl = conf.get('serverUrl')
  const token = conf.get('token')

  if (!serverUrl || !token) {
    console.error('ucli is not configured. Run: ucli configure --server <url> --token <jwt>')
    process.exit(1)
  }

  return { serverUrl, token }
}

export function saveConfig(cfg: CLIConfig): void {
  conf.set('serverUrl', cfg.serverUrl)
  conf.set('token', cfg.token)
}

export function isConfigured(): boolean {
  return Boolean(conf.get('serverUrl') && conf.get('token'))
}
