/**
 * `ucli introspect` — unified capability discovery for AI agents.
 *
 * Returns a complete machine-readable manifest of everything the agent
 * can do in a single call: OAS services, MCP servers, and the CLI
 * command reference.  This eliminates multiple round-trips that agents
 * would otherwise need (`services list` → `services info` × N →
 * `mcp list` → `mcp tools` × N).
 *
 * Methodology: This follows the "Observe → Orient → Decide → Act" (OODA)
 * loop and the ReAct pattern — agents should call `introspect` once at
 * the start of a task to build a mental model before acting.
 */
import type { Command } from 'commander'
import { getConfig } from '../config.js'
import { ServerClient, type OASEntryPublic, type McpEntryPublic } from '../lib/server-client.js'
import { toYaml } from '../lib/yaml.js'
import { ExitCode } from '../lib/exit-codes.js'
import { isJsonOutput, outputSuccess, outputError } from '../lib/output.js'

/**
 * Shape of the introspection manifest returned by `ucli introspect`.
 */
export interface IntrospectManifest {
  version: string
  services: IntrospectService[]
  mcpServers: IntrospectMcpServer[]
  commands: IntrospectCommand[]
}

export interface IntrospectService {
  name: string
  description: string
  authType: string
  remoteUrl: string
  baseEndpoint: string | null
  cacheTtl: number
}

export interface IntrospectMcpServer {
  name: string
  description: string
  transport: string
  enabled: boolean
}

export interface IntrospectCommand {
  name: string
  description: string
  usage: string
  examples: string[]
}

export function registerIntrospect(program: Command): void {
  program
    .command('introspect')
    .description('Return a complete capability manifest for AI agent discovery (services, MCP servers, commands)')
    .option('--format <fmt>', 'Output format: json | yaml', 'json')
    .action(async (opts: { format?: string }) => {
      const cfg = getConfig()
      const client = new ServerClient(cfg)

      // Fetch OAS services and MCP servers in parallel
      let oasEntries: OASEntryPublic[] = []
      let mcpEntries: McpEntryPublic[] = []

      try {
        ;[oasEntries, mcpEntries] = await Promise.all([
          client.listOAS(),
          client.listMCP(),
        ])
      } catch (err) {
        const message = (err as Error).message
        outputError(ExitCode.CONNECTIVITY_ERROR, `Failed to fetch capabilities: ${message}`,
          'Check server connectivity with: ucli doctor')
      }

      const manifest: IntrospectManifest = {
        version: '1',
        services: oasEntries.map(toIntrospectService),
        mcpServers: mcpEntries.map(toIntrospectMcpServer),
        commands: getCommandReference(),
      }

      const format = (opts.format ?? 'json').toLowerCase()

      if (isJsonOutput()) {
        outputSuccess(manifest)
        return
      }

      if (format === 'json') {
        console.log(JSON.stringify(manifest, null, 2))
        return
      }

      if (format === 'yaml') {
        console.log(toYaml(manifest))
        return
      }

      // Fallback to json
      console.log(JSON.stringify(manifest, null, 2))
    })
}

function toIntrospectService(e: OASEntryPublic): IntrospectService {
  return {
    name: e.name,
    description: e.description,
    authType: e.authType,
    remoteUrl: e.remoteUrl,
    baseEndpoint: e.baseEndpoint,
    cacheTtl: e.cacheTtl,
  }
}

function toIntrospectMcpServer(e: McpEntryPublic): IntrospectMcpServer {
  return {
    name: e.name,
    description: e.description,
    transport: e.transport,
    enabled: e.enabled,
  }
}

/**
 * Static command reference that agents can use to understand
 * what CLI commands are available and how to use them.
 */
function getCommandReference(): IntrospectCommand[] {
  return [
    {
      name: 'services list',
      description: 'List all OAS services available in the current group',
      usage: 'ucli services list [--format json|table|yaml] [--refresh]',
      examples: [
        'ucli services list',
        'ucli services list --format json',
        'ucli services list --refresh',
      ],
    },
    {
      name: 'services info',
      description: 'Show detailed information and available operations for a service',
      usage: 'ucli services info <name> [--format json|table|yaml]',
      examples: [
        'ucli services info payments',
        'ucli services info payments --format json',
      ],
    },
    {
      name: 'run',
      description: 'Execute an operation on an OAS service',
      usage: 'ucli run <service> <operation> [--format json|table|yaml] [--query <jmespath>] [--data <json|@file>] [--params <json>]',
      examples: [
        'ucli run payments listTransactions',
        'ucli run payments getTransaction --transactionId txn_123',
        'ucli run payments createCharge --data \'{"amount": 5000, "currency": "USD"}\'',
        'ucli run inventory listProducts --query "items[?stock > `0`].name"',
      ],
    },
    {
      name: 'mcp list',
      description: 'List all MCP servers available in the current group',
      usage: 'ucli mcp list [--format json|table|yaml]',
      examples: [
        'ucli mcp list',
        'ucli mcp list --format json',
      ],
    },
    {
      name: 'mcp tools',
      description: 'List tools available on a MCP server',
      usage: 'ucli mcp tools <server> [--format json|table|yaml]',
      examples: [
        'ucli mcp tools weather',
        'ucli mcp tools weather --format json',
      ],
    },
    {
      name: 'mcp run',
      description: 'Call a tool on a MCP server',
      usage: 'ucli mcp run <server> <tool> [key=value ...]',
      examples: [
        'ucli mcp run weather get_forecast location="New York"',
        'ucli mcp run search web_search query="ucli docs" limit=5',
      ],
    },
    {
      name: 'introspect',
      description: 'Return complete capability manifest (this command)',
      usage: 'ucli introspect [--format json|yaml]',
      examples: [
        'ucli introspect',
        'ucli introspect --format yaml',
      ],
    },
    {
      name: 'refresh',
      description: 'Force-refresh the local OAS cache from the server',
      usage: 'ucli refresh [--service <name>]',
      examples: [
        'ucli refresh',
        'ucli refresh --service payments',
      ],
    },
    {
      name: 'doctor',
      description: 'Check configuration, server connectivity, and token validity',
      usage: 'ucli doctor',
      examples: ['ucli doctor'],
    },
    {
      name: 'configure',
      description: 'Configure the server URL and authentication token',
      usage: 'ucli configure --server <url> --token <jwt>',
      examples: ['ucli configure --server https://oas.example.com --token eyJ...'],
    },
  ]
}
