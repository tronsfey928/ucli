import type { Command } from 'commander'
import { getConfig } from '../config.js'
import { ServerClient } from '../lib/server-client.js'
import { writeOASListCache, clearOASListCache } from '../lib/cache.js'

export function registerRefresh(program: Command): void {
  program
    .command('refresh')
    .description('Force-refresh the local OAS cache from the server')
    .action(async () => {
      const cfg = getConfig()
      const client = new ServerClient(cfg)

      console.log('Refreshing OAS list from server...')
      await clearOASListCache()

      const entries = await client.listOAS()
      if (entries.length > 0) {
        const maxTtl = Math.min(...entries.map((e) => e.cacheTtl))
        await writeOASListCache(entries, maxTtl)
      }

      console.log(`✓ Refreshed ${entries.length} service(s).`)
    })
}
