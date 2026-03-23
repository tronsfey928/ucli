import type { Command } from 'commander'
import { getConfig } from '../config.js'
import { ServerClient } from '../lib/server-client.js'
import { listMcpTools, runMcpTool } from '../lib/mcp-runner.js'

export function registerMcp(program: Command): void {
  const mcp = program
    .command('mcp')
    .description('Interact with MCP servers registered in your group')

  // mcp list
  mcp
    .command('list')
    .description('List all MCP servers available in the current group')
    .action(async () => {
      const cfg = getConfig()
      const client = new ServerClient(cfg)
      const entries = await client.listMCP()

      if (entries.length === 0) {
        console.log('No MCP servers registered in this group.')
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
    .action(async (serverName: string) => {
      const cfg = getConfig()
      const client = new ServerClient(cfg)

      let entry
      try {
        entry = await client.getMCP(serverName)
      } catch {
        console.error(`Unknown MCP server: ${serverName}`)
        console.error('Run `ucli mcp list` to see available servers.')
        process.exit(1)
      }

      let tools
      try {
        tools = await listMcpTools(entry)
      } catch (err) {
        console.error('Failed to fetch tools:', (err as Error).message)
        process.exit(1)
      }

      if (tools.length === 0) {
        console.log(`No tools found on MCP server "${serverName}".`)
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

  // mcp run <server> <tool> [args...]
  mcp
    .command('run <server> <tool> [args...]')
    .description('Call a tool on a MCP server')
    .action(async (serverName: string, toolName: string, args: string[]) => {
      const cfg = getConfig()
      const client = new ServerClient(cfg)

      let entry
      try {
        entry = await client.getMCP(serverName)
      } catch {
        console.error(`Unknown MCP server: ${serverName}`)
        console.error('Run `ucli mcp list` to see available servers.')
        process.exit(1)
      }

      try {
        await runMcpTool(entry, toolName, args)
      } catch (err) {
        console.error('Tool execution failed:', (err as Error).message)
        process.exit(1)
      }
    })
}
