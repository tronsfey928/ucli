import type { Command } from 'commander'
import { getConfig } from '../config.js'
import { ServerClient } from '../lib/server-client.js'
import { getServiceHelp, getOperationHelp, runOperation } from '../lib/oas-runner.js'
import { toYaml } from '../lib/yaml.js'
import { ExitCode } from '../lib/exit-codes.js'
import { isJsonOutput, outputSuccess, outputError } from '../lib/output.js'

const VALID_OAS_ACTIONS = ['info', 'listapi', 'apiinfo', 'invokeapi'] as const

export function registerOas(program: Command): void {
  program
    .command('oas <name> <action> [args...]')
    .description(
      'Interact with an OAS service: info | listapi | apiinfo <api> | invokeapi <api> --data <json>',
    )
    .option('--format <fmt>', 'Output format: json | table | yaml', 'json')
    .option('--data <json>', 'Request body (JSON string or @filename, for invokeapi)')
    .option('--params <json>', 'Operation parameters as JSON (for invokeapi)')
    .option('--query <jmespath>', 'Filter response with JMESPath expression')
    .option('--machine', 'Agent-friendly mode: structured JSON envelope output')
    .option('--dry-run', 'Preview the HTTP request without executing (implies --machine)')
    .allowUnknownOption(true)
    .action(async (
      name: string,
      action: string,
      args: string[],
      opts: { format?: string; data?: string; params?: string; query?: string; machine?: boolean; dryRun?: boolean },
    ) => {
      if (!(VALID_OAS_ACTIONS as readonly string[]).includes(action)) {
        outputError(ExitCode.USAGE_ERROR,
          `Unknown action: ${action}`,
          `Valid actions: ${VALID_OAS_ACTIONS.join(', ')}\nUsage:\n  ucli oas <service> info\n  ucli oas <service> listapi\n  ucli oas <service> apiinfo <api>\n  ucli oas <service> invokeapi <api> --data <json>`)
      }

      const cfg = getConfig()
      const client = new ServerClient(cfg)

      let entry
      try {
        entry = await client.getOAS(name)
      } catch {
        outputError(ExitCode.NOT_FOUND, `Service not found: ${name}`,
          'Run: ucli listoas  to see available services')
      }

      switch (action) {
        case 'info': {
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
          break
        }

        case 'listapi': {
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
          break
        }

        case 'apiinfo': {
          const apiName = args[0]
          if (!apiName) {
            outputError(ExitCode.USAGE_ERROR,
              'Missing API operation name.',
              'Usage: ucli oas <service> apiinfo <api>')
          }

          const help = await getOperationHelp(entry, apiName)

          if (isJsonOutput()) {
            outputSuccess({ operation: apiName, service: name, help })
            return
          }

          const format = (opts.format ?? 'json').toLowerCase()
          if (format === 'json') {
            console.log(JSON.stringify({ operation: apiName, service: name, help }, null, 2))
            return
          }

          console.log(`\nOperation: ${apiName} (service: ${name})`)
          console.log('─'.repeat(60))
          console.log(help)
          break
        }

        case 'invokeapi': {
          const apiName = args[0]
          if (!apiName) {
            outputError(ExitCode.USAGE_ERROR,
              'Missing API operation name.',
              'Usage: ucli oas <service> invokeapi <api> --data <json>')
          }

          const operationArgs: string[] = [apiName]
          const extraArgs = args.slice(1)
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
          break
        }
      }
    })
}
