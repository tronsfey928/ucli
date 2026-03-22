import type { Command } from 'commander'
import { getConfig } from '../config.js'
import { ServerClient } from '../lib/server-client.js'
import { runOperation } from '../lib/oas-runner.js'

export function registerRun(program: Command): void {
  program
    .command('run <service> [args...]')
    .description('Execute an operation on a service')
    .option('--format <fmt>', 'Output format: json | table | yaml', 'json')
    .option('--query <jmespath>', 'Filter response with JMESPath expression')
    .option('--data <json>', 'Request body (JSON string or @filename)')
    .allowUnknownOption(true)
    .action(async (
      service: string,
      args: string[],
      opts: { format?: string; query?: string; data?: string; args?: string[] },
    ) => {
      const cfg = getConfig()
      const client = new ServerClient(cfg)

      let entry
      try {
        entry = await client.getOAS(service)
      } catch {
        console.error(`Unknown service: ${service}`)
        console.error('Run `oas-cli services list` to see available services.')
        process.exit(1)
      }

      // Collect extra args (pass-through to openapi2cli)
      const extraArgs = opts.args ?? []
      const operationArgs = [
        ...args,
        ...extraArgs,
        ...(opts.data ? ['--data', opts.data] : []),
      ]

      const format = opts.format as 'json' | 'table' | 'yaml' | undefined
      const query = opts.query as string | undefined

      try {
        await runOperation({
          entry,
          operationArgs,
          ...(format !== undefined ? { format } : {}),
          ...(query !== undefined ? { query } : {}),
        })
      } catch (err) {
        console.error('Operation failed:', (err as Error).message)
        process.exit(1)
      }
    })
}
