/**
 * MCP tool runner using @tronsfey/mcp2cli programmatic API.
 *
 * Auth credentials are injected via McpServerConfig (headers or env) —
 * never passed as CLI arguments (which would be visible in `ps`).
 */
import type { McpEntryPublic } from './server-client.js'

// Dynamic imports to avoid top-level await in ESM
async function getMcp2cli() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clientMod = await import('@tronsfey/mcp2cli/dist/client/index.js') as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const runnerMod = await import('@tronsfey/mcp2cli/dist/runner/index.js') as any
  return { createMcpClient: clientMod.createMcpClient, getTools: runnerMod.getTools, runTool: runnerMod.runTool }
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

export async function listMcpTools(entry: McpEntryPublic): Promise<{ name: string; description?: string }[]> {
  const { createMcpClient, getTools } = await getMcp2cli()
  const config = buildMcpConfig(entry)
  const client = await createMcpClient(config)
  try {
    const tools = await getTools(client, config, { noCache: true })
    return tools
  } finally {
    if (typeof (client as { close?: unknown }).close === 'function') {
      await (client as { close: () => Promise<void> }).close()
    }
  }
}

export async function runMcpTool(entry: McpEntryPublic, toolName: string, rawArgs: string[]): Promise<void> {
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
    await runTool(client, tool, normalizedArgs, {})
  } finally {
    if (typeof (client as { close?: unknown }).close === 'function') {
      await (client as { close: () => Promise<void> }).close()
    }
  }
}
