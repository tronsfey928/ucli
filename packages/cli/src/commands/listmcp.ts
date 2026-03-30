import type { Command } from 'commander'
import { getConfig } from '../config.js'
import { ServerClient } from '../lib/server-client.js'
import { toYaml } from '../lib/yaml.js'
import { isJsonOutput, outputSuccess } from '../lib/output.js'

export function registerListMcp(program: Command): void {
  program
    .command('listmcp')
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
}
