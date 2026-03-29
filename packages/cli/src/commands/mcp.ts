import type { Command } from 'commander'
import { getConfig } from '../config.js'
import { ServerClient } from '../lib/server-client.js'
import { listMcpTools, describeMcpTool, runMcpTool } from '../lib/mcp-runner.js'
import { toYaml } from '../lib/yaml.js'
import { ExitCode } from '../lib/exit-codes.js'
import { isJsonOutput, outputSuccess, outputError } from '../lib/output.js'

export function registerMcp(program: Command): void {
  const mcp = program
    .command('mcp')
    .description('Interact with MCP servers registered in your group')

  // mcp list
  mcp
    .command('list')
    .description('List all MCP servers available in the current group')
    .option('--format <fmt>', 'Output format: table | json | yaml', 'table')
    .action(async (opts: { format?: string }) => {
      const cfg = getConfig()
      const client = new ServerClient(cfg)
      const entries = await client.listMCP()

      // Strip authConfig secrets — only expose { type }
      const safe = entries.map(({ authConfig, ...rest }) => ({
        ...rest,
        authConfig: { type: authConfig.type },
      }))

      if (isJsonOutput()) {
        outputSuccess(safe)
        return
      }

      if (entries.length === 0) {
        console.log('No MCP servers registered in this group.')
        return
      }

      const format = (opts.format ?? 'table').toLowerCase()
      if (format === 'json') {
        console.log(JSON.stringify(safe, null, 2))
        return
      }

      if (format === 'yaml') {
        console.log(toYaml(safe))
        return
      }

      const nameWidth = Math.max(10, ...entries.map(e => e.name.length))
      console.log(`\n${'SERVER'.padEnd(nameWidth)}  TRANSPORT  DESCRIPTION`)
      console.log(`${'-'.repeat(nameWidth)}  ---------  ${'-'.repeat(40)}`)
      for (const e of entries) {
        const desc = e.description.length > 60 ? e.description.slice(0, 57) + '...' : e.description
        console.log(`${e.name.padEnd(nameWidth)}  ${e.transport.padEnd(9)}  ${desc}`)
      }
      console.log()
    })

  // mcp tools <server>
  mcp
    .command('tools <server>')
    .description('List tools available on a MCP server')
    .option('--format <fmt>', 'Output format: table | json | yaml', 'table')
    .action(async (serverName: string, opts: { format?: string }) => {
      const cfg = getConfig()
      const client = new ServerClient(cfg)

      let entry
      try {
        entry = await client.getMCP(serverName)
      } catch {
        outputError(ExitCode.NOT_FOUND, `Unknown MCP server: ${serverName}`,
          'Run: ucli mcp list  to see available servers')
      }

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
        console.log(`No tools found on MCP server "${serverName}".`)
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

      console.log(`\nTools on "${serverName}":`)
      console.log('─'.repeat(60))
      for (const t of tools) {
        console.log(`  ${t.name}`)
        if (t.description) console.log(`    ${t.description}`)
      }
      console.log()
    })

  // mcp describe <server> <tool>
  mcp
    .command('describe <server> <tool>')
    .description('Show detailed schema for a tool on a MCP server')
    .option('--json', 'Output full schema as JSON (for agent consumption)')
    .action(async (serverName: string, toolName: string, opts: { json?: boolean }) => {
      const cfg = getConfig()
      const client = new ServerClient(cfg)

      let entry
      try {
        entry = await client.getMCP(serverName)
      } catch {
        outputError(ExitCode.NOT_FOUND, `Unknown MCP server: ${serverName}`,
          'Run: ucli mcp list  to see available servers')
      }

      try {
        await describeMcpTool(entry, toolName, { json: opts.json })
      } catch (err) {
        outputError(ExitCode.GENERAL_ERROR, `Failed to describe tool: ${(err as Error).message}`)
      }
    })

  // mcp run <server> <tool> [args...]
  mcp
    .command('run <server> <tool> [args...]')
    .description('Call a tool on a MCP server')
    .option('--json', 'Machine-readable JSON output')
    .option('--input-json <json>', 'Pass tool arguments as a JSON object')
    .action(async (serverName: string, toolName: string, args: string[], opts: { json?: boolean; inputJson?: string }) => {
      const cfg = getConfig()
      const client = new ServerClient(cfg)

      let entry
      try {
        entry = await client.getMCP(serverName)
      } catch {
        outputError(ExitCode.NOT_FOUND, `Unknown MCP server: ${serverName}`,
          'Run: ucli mcp list  to see available servers')
      }

      try {
        await runMcpTool(entry, toolName, args, {
          json: opts.json,
          inputJson: opts.inputJson,
        })
      } catch (err) {
        outputError(ExitCode.GENERAL_ERROR, `Tool execution failed: ${(err as Error).message}`)
      }
    })
}
