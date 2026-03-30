import type { Command } from 'commander'
import { getConfig, isConfigured } from '../config.js'
import { ServerClient } from '../lib/server-client.js'
import { readOASListCache, writeOASListCache } from '../lib/cache.js'
import { getServiceHelp } from '../lib/oas-runner.js'
import { ExitCode } from '../lib/exit-codes.js'

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
            console.log('\nTip: Run `ucli oas <service> listapi` for service-specific operations.')
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
        console.error('Run `ucli listoas` to see available services.')
        process.exit(ExitCode.NOT_FOUND)
      }

      console.log(`\n=== ${entry.name} ===`)
      console.log(`${entry.description}`)
      console.log(`\nOAS spec: ${entry.remoteUrl}`)
      console.log('\nOperations:')
      console.log('─'.repeat(60))

      const help = await getServiceHelp(entry)
      console.log(help)

      console.log('\nExamples:')
      console.log(`  ucli oas ${entry.name} listapi`)
      console.log(`  ucli oas ${entry.name} apiinfo <operation>`)
      console.log(`  ucli oas ${entry.name} invokeapi <operation> --data '{"key":"value"}'`)
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
  ucli listoas
      List all OAS services available in your group.

  ucli listmcp
      List all MCP servers available in your group.

  ucli introspect
      Return complete capability manifest in a single call (JSON).
      Ideal for AI agents: includes services, MCP servers, and command reference.

  ucli help [service]
      Show this guide, or service-specific operations.

OAS SERVICES
  ucli oas <service> info
      Show detailed service information.

  ucli oas <service> listapi
      List all available API operations.

  ucli oas <service> apiinfo <api>
      Show detailed input/output parameters for an API operation.

  ucli oas <service> invokeapi <api> [options]
      Execute an API operation.

      Options:
        --format json|table|yaml   Output format (default: json)
        --query <jmespath>         Filter response with JMESPath
        --data <json|@file>        Request body for POST/PUT/PATCH

MCP SERVERS
  ucli mcp <server> listtool
      List tools available on a MCP server.

  ucli mcp <server> toolinfo <tool>
      Show detailed input/output parameters for a tool.

  ucli mcp <server> invoketool <tool> --data <json>
      Call a tool on a MCP server.

MAINTENANCE
  ucli refresh
      Force-refresh the local OAS cache from the server.

  ucli doctor
      Check configuration, server connectivity, and token validity.

SHELL COMPLETIONS
  eval "$(ucli completions bash)"
  eval "$(ucli completions zsh)"
  ucli completions fish | source

GLOBAL FLAGS
  --debug                          Enable verbose debug logging
  --output json                    Wrap ALL output in structured JSON envelopes
                                   (for agent/automation consumption)
  -v, --version                    Show version number

ERRORS
  401 Unauthorized  → Run: ucli configure --server <url> --token <jwt>
  404 Not Found     → Check service name: ucli listoas
  4xx Client Error  → Check operation args: ucli oas <service> listapi
  5xx Server Error  → Retry or run: ucli refresh

AI AGENT QUICK START
  1. ucli introspect               # discover everything in one call
  2. ucli oas <svc> invokeapi <op> # execute OAS operations
  3. ucli mcp <srv> invoketool <t> # execute MCP tools
  4. Use --output json globally    # get structured { success, data/error } envelopes
`)
}
