import type { Command } from 'commander'
import { getConfig } from '../config.js'
import { ServerClient } from '../lib/server-client.js'
import { writeOASListCache, clearOASListCache, clearOASCache } from '../lib/cache.js'

export function registerRefresh(program: Command): void {
  program
    .command('refresh')
    .description('Force-refresh the local OAS cache from the server')
    .option('--service <name>', 'Refresh only a specific service')
    .action(async (opts: { service?: string }) => {
      const cfg = getConfig()
      const client = new ServerClient(cfg)

      console.log('Refreshing OAS list from server...')
      if (opts.service) {
        await clearOASCache(opts.service)
      } else {
        await clearOASListCache()
      }

      const entries = await client.listOAS()
      if (entries.length > 0) {
        const maxTtl = Math.min(...entries.map((e) => e.cacheTtl))
        await writeOASListCache(entries, maxTtl)
      }

      console.log(`✓ Refreshed ${entries.length} service(s).`)
    })
}
