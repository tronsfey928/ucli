import type { Command } from 'commander'
import { getConfig } from '../config.js'
import { ServerClient } from '../lib/server-client.js'
import { getServiceHelp, getOperationHelp, runOperation } from '../lib/oas-runner.js'
import { readOASListCache, writeOASListCache } from '../lib/cache.js'
import { toYaml } from '../lib/yaml.js'
import { ExitCode } from '../lib/exit-codes.js'
import { isJsonOutput, outputSuccess, outputError } from '../lib/output.js'

export function registerOas(program: Command): void {
  const oasCmd = program.command('oas').description('Manage OAS services')

  // ucli oas list
  oasCmd
    .command('list')
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

  // ucli oas describe <name>
  oasCmd
    .command('describe')
    .argument('<name>', 'Service name')
    .description('Show detailed information for an OAS service')
    .option('--format <fmt>', 'Output format: json | table | yaml', 'json')
    .action(async (name: string, opts: { format?: string }) => {
      const cfg = getConfig()
      const client = new ServerClient(cfg)

      let entry
      try {
        entry = await client.getOAS(name)
      } catch {
        outputError(ExitCode.NOT_FOUND, `Service not found: ${name}`,
          'Run: ucli oas list  to see available services')
      }

      const { authConfig, ...rest } = entry
      const safe = {
        ...rest,
        authConfig: { type: (authConfig as Record<string, unknown>)['type'] ?? rest.authType },
      }

      if (isJsonOutput()) {
        outputSuccess(safe)
        return
      }

      const format = (opts.format ?? 'json').toLowerCase()
      if (format === 'json') {
        console.log(JSON.stringify(safe, null, 2))
        return
      }

      if (format === 'yaml') {
        console.log(toYaml(safe))
        return
      }

      console.log(`\nService: ${entry.name}`)
      console.log(`Description: ${entry.description || '(none)'}`)
      console.log(`OAS URL: ${entry.remoteUrl}`)
      if (entry.baseEndpoint) console.log(`Base endpoint: ${entry.baseEndpoint}`)
      console.log(`Auth type: ${entry.authType}`)
      console.log(`Cache TTL: ${entry.cacheTtl}s`)
    })

  // ucli oas operations <name>
  oasCmd
    .command('operations')
    .argument('<name>', 'Service name')
    .description('List all available API operations for a service')
    .option('--format <fmt>', 'Output format: json | table | yaml', 'json')
    .action(async (name: string, opts: { format?: string }) => {
      const cfg = getConfig()
      const client = new ServerClient(cfg)

      let entry
      try {
        entry = await client.getOAS(name)
      } catch {
        outputError(ExitCode.NOT_FOUND, `Service not found: ${name}`,
          'Run: ucli oas list  to see available services')
      }

      const help = await getServiceHelp(entry)
      const { authConfig, ...rest } = entry
      const safe = {
        ...rest,
        authConfig: { type: (authConfig as Record<string, unknown>)['type'] ?? rest.authType },
        operationsHelp: help,
      }

      if (isJsonOutput()) {
        outputSuccess(safe)
        return
      }

      const format = (opts.format ?? 'json').toLowerCase()
      if (format === 'json') {
        console.log(JSON.stringify(safe, null, 2))
        return
      }

      if (format === 'yaml') {
        console.log(toYaml(safe))
        return
      }

      console.log(`\nService: ${entry.name}`)
      console.log(`Description: ${entry.description || '(none)'}`)
      console.log('\nAvailable operations:')
      console.log('─'.repeat(60))
      console.log(help)
    })

  // ucli oas operation <name> <api>
  oasCmd
    .command('operation')
    .argument('<name>', 'Service name')
    .argument('<api>', 'API operation name')
    .description('Show detailed input/output parameters for a specific API operation')
    .option('--format <fmt>', 'Output format: json | table | yaml', 'json')
    .action(async (name: string, api: string, opts: { format?: string }) => {
      const cfg = getConfig()
      const client = new ServerClient(cfg)

      let entry
      try {
        entry = await client.getOAS(name)
      } catch {
        outputError(ExitCode.NOT_FOUND, `Service not found: ${name}`,
          'Run: ucli oas list  to see available services')
      }

      const help = await getOperationHelp(entry, api)

      if (isJsonOutput()) {
        outputSuccess({ operation: api, service: name, help })
        return
      }

      const format = (opts.format ?? 'json').toLowerCase()
      if (format === 'json') {
        console.log(JSON.stringify({ operation: api, service: name, help }, null, 2))
        return
      }

      console.log(`\nOperation: ${api} (service: ${name})`)
      console.log('─'.repeat(60))
      console.log(help)
    })

  // ucli oas invoke <name> <api>
  oasCmd
    .command('invoke')
    .argument('<name>', 'Service name')
    .argument('<api>', 'API operation name')
    .description('Execute an API operation on an OAS service')
    .option('--format <fmt>', 'Output format: json | table | yaml', 'json')
    .option('--data <json>', 'Request body (JSON string or @filename)')
    .option('--params <json>', 'Operation parameters as JSON')
    .option('--query <jmespath>', 'Filter response with JMESPath expression')
    .option('--machine', 'Agent-friendly mode: structured JSON envelope output')
    .option('--dry-run', 'Preview the HTTP request without executing (implies --machine)')
    .allowUnknownOption(true)
    .action(async (
      name: string,
      api: string,
      opts: { format?: string; data?: string; params?: string; query?: string; machine?: boolean; dryRun?: boolean },
      cmd: Command,
    ) => {
      const cfg = getConfig()
      const client = new ServerClient(cfg)

      let entry
      try {
        entry = await client.getOAS(name)
      } catch {
        outputError(ExitCode.NOT_FOUND, `Service not found: ${name}`,
          'Run: ucli oas list  to see available services')
      }

      const operationArgs: string[] = [api]
      const extraArgs = cmd.args.slice(2)
      operationArgs.push(...extraArgs)

      if (opts.params) {
        let parsed: unknown
        try {
          parsed = JSON.parse(opts.params)
        } catch {
          outputError(ExitCode.USAGE_ERROR,
            'Invalid --params JSON.',
            'Example: --params \'{"petId": 1}\'')
        }
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
            if (v === undefined || v === null) continue
            const strVal = typeof v === 'object' ? JSON.stringify(v) : String(v)
            operationArgs.push(`--${k}`, strVal)
          }
        }
      }

      if (opts.data) {
        operationArgs.push('--data', opts.data)
      }

      const format = opts.format as 'json' | 'table' | 'yaml' | undefined
      const query = opts.query as string | undefined
      const machine = opts.machine ?? false
      const dryRun = opts.dryRun ?? false

      try {
        await runOperation({
          entry,
          operationArgs,
          ...(format !== undefined ? { format } : {}),
          ...(query !== undefined ? { query } : {}),
          ...(machine ? { machine } : {}),
          ...(dryRun ? { dryRun } : {}),
        })
      } catch (err) {
        outputError(ExitCode.GENERAL_ERROR,
          `Operation failed: ${(err as Error).message}`)
      }
    })
}
