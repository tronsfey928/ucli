/**
 * Bridge between oas-cli and @tronsfey/openapi2cli run mode.
 *
 * Spawns openapi2cli as a child process, injecting auth config
 * as environment variables (never exposed to the agent's shell).
 */
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { join, dirname } from 'node:path'
import type { OASEntryPublic } from './server-client.js'

const require = createRequire(import.meta.url)

function resolveOpenapi2CliBin(): string {
  try {
    const pkgPath = require.resolve('@tronsfey/openapi2cli/package.json')
    const pkgDir = dirname(pkgPath)
    // @tronsfey/openapi2cli exposes its binary; find it
    const pkg = require('@tronsfey/openapi2cli/package.json') as { bin?: Record<string, string> }
    const binEntry = pkg.bin?.['openapi2cli'] ?? 'bin/openapi2cli.js'
    return join(pkgDir, binEntry)
  } catch {
    throw new Error(
      '@tronsfey/openapi2cli is not installed. Run: pnpm add @tronsfey/openapi2cli in packages/cli',
    )
  }
}

export interface RunOptions {
  entry: OASEntryPublic
  /** Operation command args (e.g. ['listPets', '--limit', '10']) */
  operationArgs: string[]
  format?: 'json' | 'table' | 'yaml'
  query?: string
}

/**
 * Build auth environment variables for injection into child process.
 * The calling shell (and thus the AI agent) never sees these values.
 */
function buildAuthEnv(entry: OASEntryPublic): Record<string, string> {
  const cfg = entry.authConfig
  const prefix = entry.name.toUpperCase().replace(/[^A-Z0-9]/g, '_')

  switch (cfg['type']) {
    case 'bearer':
      return { [`${prefix}_TOKEN`]: cfg['token'] as string }

    case 'api_key':
      return { [`${prefix}_API_KEY`]: cfg['key'] as string }

    case 'basic':
      return { [`${prefix}_CREDENTIALS`]: `${cfg['username']}:${cfg['password']}` }

    case 'oauth2_cc':
      return {
        [`${prefix}_CLIENT_ID`]: cfg['clientId'] as string,
        [`${prefix}_CLIENT_SECRET`]: cfg['clientSecret'] as string,
        [`${prefix}_SCOPES`]: (cfg['scopes'] as string[]).join(' '),
      }

    default:
      return {}
  }
}

export async function runOperation(opts: RunOptions): Promise<void> {
  const bin = resolveOpenapi2CliBin()
  const { entry, operationArgs, format, query } = opts

  const args = [
    'run',
    '--oas', entry.remoteUrl,
    '--cache-ttl', String(entry.cacheTtl),
    ...(entry.baseEndpoint ? ['--endpoint', entry.baseEndpoint] : []),
    ...(format ? ['--format', format] : []),
    ...(query ? ['--query', query] : []),
    ...operationArgs,
  ]

  const authEnv = buildAuthEnv(entry)

  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [bin, ...args], {
      stdio: 'inherit',
      env: {
        ...process.env,
        ...authEnv,  // inject auth — not visible to parent shell
      },
    })

    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`openapi2cli exited with code ${code}`))
    })
    child.on('error', reject)
  })
}

/**
 * Get list of available operations for a service by running `--help`.
 * Returns the raw help text from openapi2cli.
 */
export async function getServiceHelp(entry: OASEntryPublic): Promise<string> {
  const bin = resolveOpenapi2CliBin()
  const args = [
    'run',
    '--oas', entry.remoteUrl,
    '--cache-ttl', String(entry.cacheTtl),
    '--help',
  ]

  return new Promise<string>((resolve, reject) => {
    let output = ''
    const child = spawn(process.execPath, [bin, ...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    child.stdout?.on('data', (d: Buffer) => { output += d.toString() })
    child.stderr?.on('data', (d: Buffer) => { output += d.toString() })
    child.on('close', () => resolve(output))
    child.on('error', reject)
  })
}
