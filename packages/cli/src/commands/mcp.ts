import type { Command } from 'commander'
import { getConfig } from '../config.js'
import { ServerClient } from '../lib/server-client.js'
import { listMcpTools, describeMcpTool, runMcpTool } from '../lib/mcp-runner.js'
import { toYaml } from '../lib/yaml.js'
import { ExitCode } from '../lib/exit-codes.js'
import { isJsonOutput, outputSuccess, outputError } from '../lib/output.js'

const VALID_MCP_ACTIONS = ['listtool', 'toolinfo', 'invoketool'] as const

export function registerMcp(program: Command): void {
  program
    .command('mcp <name> <action> [args...]')
    .description(
      'Interact with a MCP server: listtool | toolinfo <tool> | invoketool <tool> --data <json>',
    )
    .option('--format <fmt>', 'Output format: table | json | yaml', 'table')
    .option('--data <json>', 'Tool arguments as a JSON object (for invoketool)')
    .option('--json', 'Machine-readable JSON output')
    .allowUnknownOption(true)
    .action(async (name: string, action: string, args: string[], opts: { format?: string; data?: string; json?: boolean }) => {
      if (!(VALID_MCP_ACTIONS as readonly string[]).includes(action)) {
        outputError(ExitCode.USAGE_ERROR,
          `Unknown action: ${action}`,
          `Valid actions: ${VALID_MCP_ACTIONS.join(', ')}\nUsage:\n  ucli mcp <server> listtool\n  ucli mcp <server> toolinfo <tool>\n  ucli mcp <server> invoketool <tool> --data <json>`)
      }

      const cfg = getConfig()
      const client = new ServerClient(cfg)

      let entry
      try {
        entry = await client.getMCP(name)
      } catch {
        outputError(ExitCode.NOT_FOUND, `Unknown MCP server: ${name}`,
          'Run: ucli listmcp  to see available servers')
      }

      switch (action) {
        case 'listtool': {
          let tools
          try {
            tools = await listMcpTools(entry)
          } catch (err) {
            outputError(ExitCode.GENERAL_ERROR, `Failed to fetch tools: ${(err as Error).message}`)
          }

          if (isJsonOutput()) {
            outputSuccess(tools)
            return
          }

          if (tools.length === 0) {
            console.log(`No tools found on MCP server "${name}".`)
            return
          }

          const format = (opts.format ?? 'table').toLowerCase()
          if (format === 'json') {
            console.log(JSON.stringify(tools, null, 2))
            return
          }

          if (format === 'yaml') {
            console.log(toYaml(tools))
            return
          }

          console.log(`\nTools on "${name}":`)
          console.log('─'.repeat(60))
          for (const t of tools) {
            console.log(`  ${t.name}`)
            if (t.description) console.log(`    ${t.description}`)
          }
          console.log()
          break
        }

        case 'toolinfo': {
          const toolName = args[0]
          if (!toolName) {
            outputError(ExitCode.USAGE_ERROR,
              'Missing tool name.',
              'Usage: ucli mcp <server> toolinfo <tool>')
          }

          try {
            await describeMcpTool(entry, toolName, { json: opts.json })
          } catch (err) {
            outputError(ExitCode.GENERAL_ERROR, `Failed to describe tool: ${(err as Error).message}`)
          }
          break
        }

        case 'invoketool': {
          const toolName = args[0]
          if (!toolName) {
            outputError(ExitCode.USAGE_ERROR,
              'Missing tool name.',
              'Usage: ucli mcp <server> invoketool <tool> --data <json>')
          }

          const extraArgs = args.slice(1)
          try {
            await runMcpTool(entry, toolName, extraArgs, {
              json: opts.json,
              inputJson: opts.data,
            })
          } catch (err) {
            outputError(ExitCode.GENERAL_ERROR, `Tool execution failed: ${(err as Error).message}`)
          }
          break
        }
      }
    })
}
