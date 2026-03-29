import type { Command } from 'commander'
import { getConfig } from '../config.js'
import { ServerClient } from '../lib/server-client.js'
import { runOperation } from '../lib/oas-runner.js'
import { ExitCode } from '../lib/exit-codes.js'
import { outputError } from '../lib/output.js'

export function registerRun(program: Command): void {
  program
    .command('run [service] [args...]')
    .description('Execute an operation on a service')
    .option('--service <name>', 'Service name (from `services list`)')
    .option('--operation <id>', 'OperationId to execute')
    .option('--params <json>', 'JSON string of operation parameters')
    .option('--format <fmt>', 'Output format: json | table | yaml', 'json')
    .option('--query <jmespath>', 'Filter response with JMESPath expression')
    .option('--data <json>', 'Request body (JSON string or @filename)')
    .option('--machine', 'Agent-friendly mode: structured JSON envelope output')
    .option('--dry-run', 'Preview the HTTP request without executing (implies --machine)')
    .allowUnknownOption(true)
    .action(async (
      serviceArg: string | undefined,
      args: string[],
      opts: { service?: string; operation?: string; params?: string; format?: string; query?: string; data?: string; machine?: boolean; dryRun?: boolean; args?: string[] },
    ) => {
      if (serviceArg && opts.service && serviceArg !== opts.service) {
        outputError(ExitCode.USAGE_ERROR,
          `Conflicting service values: positional "${serviceArg}" and --service "${opts.service}". Use either the positional argument or --service flag, not both.`)
      }

      const service = opts.service ?? serviceArg
      if (!service) {
        outputError(ExitCode.USAGE_ERROR,
          'Missing service name. Use positional <service> or --service <name>.',
          'Run: ucli services list  to see available services')
      }

      const cfg = getConfig()
      const client = new ServerClient(cfg)

      let entry
      try {
        entry = await client.getOAS(service)
      } catch {
        outputError(ExitCode.NOT_FOUND,
          `Unknown service: ${service}`,
          'Run: ucli services list  to see available services')
      }

      // Collect extra args (pass-through to openapi2cli)
      const extraArgs = opts.args ?? []
      const operationArgs = [...args, ...extraArgs]

      if (opts.operation) {
        operationArgs.unshift(opts.operation)
      }

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
