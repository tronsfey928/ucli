import type { Command } from 'commander'
import { saveConfig, isConfigured } from '../config.js'
import { ServerClient } from '../lib/server-client.js'
import { ExitCode } from '../lib/exit-codes.js'

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
      console.log(`Connecting to ${serverUrl}...`)
      const client = new ServerClient({ serverUrl, token })

      try {
        await client.listOAS()
        saveConfig({ serverUrl, token })
        console.log('✓ Configuration saved successfully.')
        console.log(`  Server: ${serverUrl}`)
        console.log(`  Token:  ${token.slice(0, 20)}...`)
      } catch (err) {
        console.error('Connection failed:', (err as Error).message)
        console.error('Please check the server URL and token.')
        process.exit(ExitCode.CONNECTIVITY_ERROR)
      }
    })
}
