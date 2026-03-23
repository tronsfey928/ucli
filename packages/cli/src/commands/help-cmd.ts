import type { Command } from 'commander'
import { getConfig, isConfigured } from '../config.js'
import { ServerClient } from '../lib/server-client.js'
import { readOASListCache, writeOASListCache } from '../lib/cache.js'
import { getServiceHelp } from '../lib/oas-runner.js'

export function registerHelp(program: Command): void {
  program
    .command('help [service]')
    .description('Show usage guide. Pass a service name for service-specific operations.')
    .action(async (service?: string) => {
      if (!service) {
        printGeneralHelp()
        if (isConfigured()) {
          const cfg = getConfig()
          const client = new ServerClient(cfg)
          let entries = await readOASListCache()
          if (!entries) {
            entries = await client.listOAS()
            if (entries.length > 0) {
              const maxTtl = Math.min(...entries.map((e) => e.cacheTtl))
              await writeOASListCache(entries, maxTtl)
            }
          }
          if (entries.length > 0) {
            console.log('\nAvailable services:')
            for (const e of entries) {
              console.log(`  ${e.name.padEnd(20)} ${e.description}`)
            }
            console.log('\nTip: Run `ucli help <service>` for service-specific operations.')
          }
        } else {
          console.log('\nRun `ucli configure --server <url> --token <jwt>` to get started.')
        }
        return
      }

      // Service-specific help
      const cfg = getConfig()
      const client = new ServerClient(cfg)

      let entry
      try {
        entry = await client.getOAS(service)
      } catch {
        console.error(`Unknown service: ${service}`)
        console.error('Run `ucli services list` to see available services.')
        process.exit(1)
      }

      console.log(`\n=== ${entry.name} ===`)
      console.log(`${entry.description}`)
      console.log(`\nOAS spec: ${entry.remoteUrl}`)
      console.log('\nOperations:')
      console.log('─'.repeat(60))

      const help = await getServiceHelp(entry)
      console.log(help)

      console.log('\nExamples:')
      console.log(`  ucli run ${entry.name} <operation>`)
      console.log(`  ucli run ${entry.name} <operation> --format table`)
      console.log(`  ucli run ${entry.name} <operation> --query "results[*].id"`)
      console.log(`  ucli run ${entry.name} <operation> --data '{"key":"value"}'`)
    })
}

function printGeneralHelp(): void {
  console.log(`
ucli — OpenAPI & MCP Gateway for AI Agents
════════════════════════════════════════

SETUP
  ucli configure --server <url> --token <jwt>
      Configure server connection and authentication.

DISCOVERY
  ucli services list
      List all OAS services available in your group.

  ucli services info <service>
      Show detailed service info and all available operations.

  ucli help [service]
      Show this guide, or service-specific operations.

EXECUTION
  ucli run <service> <operation> [options]
      Execute a service operation.

      Options:
        --format json|table|yaml   Output format (default: json)
        --query <jmespath>         Filter response with JMESPath
        --data <json|@file>        Request body for POST/PUT/PATCH

MAINTENANCE
  ucli refresh
      Force-refresh the local OAS cache from the server.

ERRORS
  401 Unauthorized  → Run: ucli configure --server <url> --token <jwt>
  404 Not Found     → Check service name: ucli services list
  4xx Client Error  → Check operation args: ucli services info <service>
  5xx Server Error  → Retry or run: ucli refresh
`)
}
