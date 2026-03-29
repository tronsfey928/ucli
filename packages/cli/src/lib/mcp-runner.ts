/**
 * MCP tool runner using @tronsfey/mcp2cli programmatic API.
 *
 * Auth credentials are injected via McpServerConfig (headers or env) —
 * never passed as CLI arguments (which would be visible in `ps`).
 */
import type { McpEntryPublic } from './server-client.js'

/**
 * Resolve a named export from a module that may be CJS-wrapped (exports live
 * under `module.default`) or a plain ESM module (named exports at top level).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolve(mod: any, name: string): unknown {
  if (typeof mod[name] === 'function') return mod[name]
  if (mod.default && typeof mod.default[name] === 'function') return mod.default[name]
  throw new Error(`Cannot resolve export "${name}" from module`)
}

async function getMcp2cli() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clientMod = await import('@tronsfey/mcp2cli/dist/client/index.js') as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const runnerMod = await import('@tronsfey/mcp2cli/dist/runner/index.js') as any
  return {
    createMcpClient: resolve(clientMod, 'createMcpClient') as (...args: unknown[]) => Promise<unknown>,
    getTools: resolve(runnerMod, 'getTools') as (...args: unknown[]) => Promise<{ name: string; description?: string; inputSchema?: unknown }[]>,
    runTool: resolve(runnerMod, 'runTool') as (...args: unknown[]) => Promise<void>,
    describeTool: resolve(runnerMod, 'describeTool') as (...args: unknown[]) => void,
    describeToolJson: resolve(runnerMod, 'describeToolJson') as (...args: unknown[]) => void,
  }
}

async function closeClient(client: unknown): Promise<void> {
  if (typeof (client as { close?: unknown }).close === 'function') {
    await (client as { close: () => Promise<void> }).close()
  }
}

function buildMcpConfig(entry: McpEntryPublic): Record<string, unknown> {
  const base: Record<string, unknown> = { type: entry.transport }
  if (entry.transport === 'http') {
    base.url = entry.serverUrl
  } else {
    base.command = entry.command
  }
  const auth = entry.authConfig
  if (auth.type === 'http_headers') {
    base.headers = auth.headers
  } else if (auth.type === 'env') {
    base.env = auth.env
  }
  return base
}

export async function listMcpTools(entry: McpEntryPublic): Promise<{ name: string; description?: string; inputSchema?: unknown }[]> {
  const { createMcpClient, getTools } = await getMcp2cli()
  const config = buildMcpConfig(entry)
  const client = await createMcpClient(config)
  try {
    const tools = await getTools(client, config, { noCache: true })
    return tools
  } finally {
    await closeClient(client)
  }
}

export async function describeMcpTool(
  entry: McpEntryPublic,
  toolName: string,
  opts?: { json?: boolean },
): Promise<void> {
  const { createMcpClient, getTools, describeTool, describeToolJson } = await getMcp2cli()
  const config = buildMcpConfig(entry)
  const client = await createMcpClient(config)
  try {
    const tools = await getTools(client, config, { noCache: false, cacheTtl: 3600 })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tool = tools.find((t: any) => t.name === toolName)
    if (!tool) throw new Error(`Tool "${toolName}" not found on MCP server "${entry.name}"`)
    if (opts?.json) {
      describeToolJson(tool)
    } else {
      describeTool(tool)
    }
  } finally {
    await closeClient(client)
  }
}

export async function runMcpTool(
  entry: McpEntryPublic,
  toolName: string,
  rawArgs: string[],
  opts?: { json?: boolean; inputJson?: string },
): Promise<void> {
  const { createMcpClient, getTools, runTool } = await getMcp2cli()
  const config = buildMcpConfig(entry)
  const client = await createMcpClient(config)
  try {
    const tools = await getTools(client, config, { noCache: false, cacheTtl: 3600 })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tool = tools.find((t: any) => t.name === toolName)
    if (!tool) throw new Error(`Tool "${toolName}" not found on MCP server "${entry.name}"`)
    const normalizedArgs: string[] = []
    for (const arg of rawArgs) {
      if (arg.includes('=') && !arg.startsWith('--')) {
        const idx = arg.indexOf('=')
        const key = arg.slice(0, idx)
        const value = arg.slice(idx + 1)
        normalizedArgs.push(`--${key}`, value)
      } else {
        normalizedArgs.push(arg)
      }
    }
    await runTool(client, tool, normalizedArgs, {
      ...(opts?.json ? { json: true } : {}),
      ...(opts?.inputJson ? { inputJson: opts.inputJson } : {}),
    })
  } finally {
    await closeClient(client)
  }
}
