import type { Command } from 'commander'
import { saveConfig } from '../config.js'
import { ServerClient } from '../lib/server-client.js'
import { ExitCode } from '../lib/exit-codes.js'
import { isJsonOutput, outputSuccess, outputError } from '../lib/output.js'

export function registerConfigure(program: Command): void {
  program
    .command('configure')
    .description('Configure the OAS Gateway server URL and authentication token')
    .requiredOption('--server <url>', 'OAS Gateway server URL (e.g. https://oas.example.com)')
    .requiredOption('--token <jwt>', 'Group JWT token issued by the server admin')
    .action(async (opts: { server: string; token: string }) => {
      const serverUrl = opts.server.replace(/\/$/, '')
      const token = opts.token

      // Validate connectivity before saving
      if (!isJsonOutput()) {
        console.log(`Connecting to ${serverUrl}...`)
      }
      const client = new ServerClient({ serverUrl, token })

      try {
        await client.listOAS()
        saveConfig({ serverUrl, token })

        if (isJsonOutput()) {
          outputSuccess({ serverUrl, configured: true })
          return
        }

        console.log('✓ Configuration saved successfully.')
        console.log(`  Server: ${serverUrl}`)
        console.log(`  Token:  ${token.slice(0, 20)}...`)
      } catch (err) {
        outputError(ExitCode.CONNECTIVITY_ERROR,
          `Connection failed: ${(err as Error).message}`,
          'Check the server URL and token')
      }
    })
}
