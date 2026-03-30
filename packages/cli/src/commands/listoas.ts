import type { Command } from 'commander'
import { getConfig } from '../config.js'
import { ServerClient } from '../lib/server-client.js'
import { readOASListCache, writeOASListCache } from '../lib/cache.js'
import { toYaml } from '../lib/yaml.js'
import { isJsonOutput, outputSuccess } from '../lib/output.js'

export function registerListOas(program: Command): void {
  program
    .command('listoas')
    .description('List all OAS services available in the current group')
    .option('--refresh', 'Bypass local cache and fetch fresh from server')
    .option('--format <fmt>', 'Output format: table | json | yaml', 'table')
    .action(async (opts: { refresh?: boolean; format?: string }) => {
      const cfg = getConfig()
      const client = new ServerClient(cfg)

      const useCache = !opts.refresh
      let entries = useCache ? await readOASListCache() : null

      if (!entries) {
        entries = await client.listOAS()
        if (entries.length > 0) {
          const maxTtl = Math.min(...entries.map((e) => e.cacheTtl))
          await writeOASListCache(entries, maxTtl)
        }
      }

      // Strip authConfig secrets — only expose { type }
      const safe = entries.map(({ authConfig, ...rest }) => ({
        ...rest,
        authConfig: { type: (authConfig as Record<string, unknown>)['type'] ?? rest.authType },
      }))

      if (isJsonOutput()) {
        outputSuccess(safe)
        return
      }

      const format = (opts.format ?? 'table').toLowerCase()

      if (entries.length === 0) {
        console.log('No services registered in this group.')
        return
      }

      if (format === 'json') {
        console.log(JSON.stringify(safe, null, 2))
        return
      }

      if (format === 'yaml') {
        console.log(toYaml(safe))
        return
      }

      const nameWidth = Math.max(10, ...entries.map((e) => e.name.length))
      console.log(`\n${'SERVICE'.padEnd(nameWidth)}  AUTH      DESCRIPTION`)
      console.log(`${'-'.repeat(nameWidth)}  --------  ${'-'.repeat(40)}`)
      for (const e of entries) {
        const auth = e.authType.padEnd(8)
        const desc = e.description.length > 60 ? e.description.slice(0, 57) + '...' : e.description
        console.log(`${e.name.padEnd(nameWidth)}  ${auth}  ${desc}`)
      }
      console.log()
    })
}
