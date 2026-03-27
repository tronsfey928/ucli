/**
 * `ucli doctor` — diagnostic tool for configuration, connectivity, and token validation.
 *
 * Checks:
 *  1. Configuration file exists and is readable
 *  2. Server URL is reachable (GET /api/v1/health)
 *  3. JWT token is accepted (GET /api/v1/oas — expects 200 or empty list)
 */
import type { Command } from 'commander'
import { isConfigured, getConfig } from '../config.js'
import { ServerClient } from '../lib/server-client.js'
import { ExitCode } from '../lib/exit-codes.js'
import { debug } from '../lib/errors.js'
import axios from 'axios'

interface CheckResult {
  name: string
  ok: boolean
  detail: string
}

export function registerDoctor(program: Command): void {
  program
    .command('doctor')
    .description('Check configuration, server connectivity, and token validity')
    .action(async () => {
      const results: CheckResult[] = []

      // ── Check 1: Configuration ──────────────────────────────────────
      debug('Checking configuration...')
      if (!isConfigured()) {
        results.push({
          name: 'Configuration',
          ok: false,
          detail: 'Not configured. Run: ucli configure --server <url> --token <jwt>',
        })
        printResults(results)
        process.exit(ExitCode.CONFIG_ERROR)
      }

      let cfg: { serverUrl: string; token: string }
      try {
        cfg = getConfig()
        results.push({
          name: 'Configuration',
          ok: true,
          detail: `Server: ${cfg.serverUrl}`,
        })
      } catch (err) {
        results.push({
          name: 'Configuration',
          ok: false,
          detail: `Failed to read config: ${(err as Error).message}`,
        })
        printResults(results)
        process.exit(ExitCode.CONFIG_ERROR)
      }

      // ── Check 2: Connectivity (health endpoint, no auth required) ──
      debug(`Checking connectivity to ${cfg.serverUrl}...`)
      try {
        const healthUrl = `${cfg.serverUrl}/api/v1/health`
        const resp = await axios.get(healthUrl, { timeout: 10_000 })
        results.push({
          name: 'Server connectivity',
          ok: resp.status === 200,
          detail: resp.status === 200
            ? `Health endpoint OK (${cfg.serverUrl})`
            : `Unexpected status: ${resp.status}`,
        })
      } catch (err) {
        const msg = axios.isAxiosError(err)
          ? err.code ?? err.message
          : (err as Error).message
        results.push({
          name: 'Server connectivity',
          ok: false,
          detail: `Cannot reach server: ${msg}`,
        })
      }

      // ── Check 3: Token validity (authenticated request) ────────────
      debug('Validating JWT token...')
      try {
        const client = new ServerClient(cfg)
        await client.listOAS()
        results.push({
          name: 'Authentication',
          ok: true,
          detail: 'Token accepted by server',
        })
      } catch (err) {
        const msg = (err as Error).message
        results.push({
          name: 'Authentication',
          ok: false,
          detail: `Token rejected: ${msg}`,
        })
      }

      printResults(results)

      const allOk = results.every((r) => r.ok)
      process.exit(allOk ? ExitCode.SUCCESS : ExitCode.GENERAL_ERROR)
    })
}

function printResults(results: CheckResult[]): void {
  console.log('\nucli doctor\n' + '═'.repeat(40))
  for (const r of results) {
    const icon = r.ok ? '✓' : '✖'
    console.log(`  ${icon} ${r.name}: ${r.detail}`)
  }
  console.log()
}
