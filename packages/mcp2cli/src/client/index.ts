import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { McpServerConfig } from '../types/index';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const pkg = require('../../package.json') as { version: string };

/**
 * Parse a command string into command and args array.
 * Handles simple quoting (single and double quotes).
 */
export function parseCommand(cmdString: string): { command: string; args: string[] } {
  const parts: string[] = [];
  let current = '';
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < cmdString.length; i++) {
    const ch = cmdString[i];
    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
    } else if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
    } else if (ch === ' ' && !inSingle && !inDouble) {
      if (current) {
        parts.push(current);
        current = '';
      }
    } else {
      current += ch;
    }
  }
  if (current) parts.push(current);
  if (inSingle || inDouble) {
    throw new Error(`Unclosed quote in command: ${cmdString}`);
  }
  if (parts.length === 0) {
    throw new Error('Empty command string');
  }

  const [command, ...args] = parts;
  return { command, args };
}

/** Create a new MCP Client instance with standard client info. */
function makeClient(): Client {
  return new Client({
    name: 'mcp2cli',
    version: pkg.version,
  });
}

/**
 * Return true when a Streamable HTTP transport error does NOT indicate an
 * authentication / authorisation failure.  All non-auth errors (404, 405,
 * HTML response bodies, network errors, etc.) should trigger a fallback to
 * the legacy SSE transport because the server may simply not support the
 * newer protocol.  If the SSE attempt also fails the caller will surface that
 * error to the user.
 *
 * Auth failures (401 / 403) are always propagated immediately so the user
 * sees the real problem rather than a confusing SSE error.
 */
export function isTransportUnsupported(err: unknown): boolean {
  const code =
    err &&
    typeof err === 'object' &&
    'code' in err &&
    typeof (err as { code: unknown }).code === 'number'
      ? (err as { code: number }).code
      : undefined;
  const msg = err instanceof Error ? err.message : String(err);

  // Explicit authentication / authorisation failures — do NOT fall back.
  if (code === 401 || code === 403 || /\b401\b|\bunauthorized\b|\b403\b|\bforbidden\b/i.test(msg)) {
    return false;
  }
  // Fallback only for explicit "transport not supported" signals.
  // This avoids masking other Streamable HTTP failures by incorrectly retrying
  // on SSE (which often fails differently and hides the original cause).
  if (code === 404 || code === 405) {
    return true;
  }
  if (/\b404\b|\b405\b|\bcannot\s+post\b|\bmethod\s+not\s+allowed\b|\bnot\s+found\b/i.test(msg)) {
    return true;
  }

  return false;
}

/**
 * Create and connect an MCP client using the appropriate transport.
 *
 * For HTTP servers the function attempts the modern Streamable HTTP transport
 * first (MCP protocol ≥ 2025-03-26) and automatically falls back to the
 * legacy SSE transport (MCP protocol 2024-11-05) when the endpoint returns
 * a 404/405 response.  A fresh Client instance is created for each attempt
 * so that a failed connection attempt never leaves the client in a partially-
 * initialised state.
 */
export async function createMcpClient(
  config: McpServerConfig,
  verbose = false
): Promise<Client> {
  if (config.type === 'stdio') {
    if (!config.command) {
      throw new Error('stdio config requires a command');
    }
    const { command, args } = parseCommand(config.command);
    const env: Record<string, string> = {
      ...Object.fromEntries(
        Object.entries(process.env).filter(([, v]) => v !== undefined) as [string, string][]
      ),
      ...(config.env ?? {}),
    };
    if (verbose) {
      console.error(`[debug] Connecting via stdio: ${command} ${args.join(' ')}`);
    }
    const client = makeClient();
    const transport = new StdioClientTransport({ command, args, env });
    await client.connect(transport);
    if (verbose) {
      console.error(`[debug] Connected via stdio successfully`);
    }
    return client;
  }

  if (!config.url) {
    throw new Error('http config requires a url');
  }
  const serverUrl = new URL(config.url);
  const headers = config.headers ?? {};

  // --- Attempt 1: modern Streamable HTTP (MCP protocol ≥ 2025-03-26) ------
  if (verbose) {
    console.error(`[debug] Attempting Streamable HTTP connection to ${config.url}`);
  }
  try {
    const client = makeClient();
    const transport = new StreamableHTTPClientTransport(serverUrl, {
      requestInit: { headers },
    });
    await client.connect(transport);
    if (verbose) {
      console.error(`[debug] Connected via Streamable HTTP successfully`);
    }
    return client;
  } catch (err) {
    if (verbose) {
      console.error(`[debug] Streamable HTTP failed: ${(err as Error).message}`);
    }
    if (!isTransportUnsupported(err)) {
      // Not a "transport not supported" error – propagate it so the user
      // sees the real problem (auth failure, bad URL, etc.).
      throw err;
    }
    if (verbose) {
      console.error(`[debug] Falling back to SSE transport…`);
    }
  }

  // --- Attempt 2: legacy SSE transport (MCP protocol 2024-11-05) ----------
  // Use a brand-new Client so the previous failed attempt's state is discarded.
  if (verbose) {
    console.error(`[debug] Attempting SSE connection to ${config.url}`);
  }
  const client = makeClient();
  const sseTransport = new SSEClientTransport(serverUrl, {
    requestInit: { headers },
  });
  await client.connect(sseTransport);
  if (verbose) {
    console.error(`[debug] Connected via SSE successfully`);
  }
  return client;
}
