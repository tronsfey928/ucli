import type { Command } from 'commander'
import { getConfig } from '../config.js'
import { ServerClient } from '../lib/server-client.js'
import { readOASListCache, writeOASListCache } from '../lib/cache.js'
import { getServiceHelp } from '../lib/oas-runner.js'

export function registerServices(program: Command): void {
  const services = program
    .command('services')
    .description('Manage and inspect available OAS services')

  // services list
  services
    .command('list')
    .description('List all OAS services available in the current group')
    .option('--no-cache', 'Bypass local cache and fetch fresh from server')
    .action(async (opts: { cache: boolean }) => {
      const cfg = getConfig()
      const client = new ServerClient(cfg)

      let entries = opts.cache ? await readOASListCache() : null

      if (!entries) {
        entries = await client.listOAS()
        if (entries.length > 0) {
          const maxTtl = Math.min(...entries.map((e) => e.cacheTtl))
          await writeOASListCache(entries, maxTtl)
        }
      }

      if (entries.length === 0) {
        console.log('No services registered in this group.')
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

  // services info <name>
  services
    .command('info <name>')
    .description('Show detailed information and available operations for a service')
    .action(async (name: string) => {
      const cfg = getConfig()
      const client = new ServerClient(cfg)

      let entry
      try {
        entry = await client.getOAS(name)
      } catch (err) {
        console.error(`Service not found: ${name}`)
        console.error('Run `oas-cli services list` to see available services.')
        process.exit(1)
      }

      console.log(`\nService: ${entry.name}`)
      console.log(`Description: ${entry.description || '(none)'}`)
      console.log(`OAS URL: ${entry.remoteUrl}`)
      if (entry.baseEndpoint) console.log(`Base endpoint: ${entry.baseEndpoint}`)
      console.log(`Auth type: ${entry.authType}`)
      console.log(`Cache TTL: ${entry.cacheTtl}s`)

      console.log('\nAvailable operations:')
      console.log('─'.repeat(60))

      const help = await getServiceHelp(entry)
      console.log(help)
    })
}
