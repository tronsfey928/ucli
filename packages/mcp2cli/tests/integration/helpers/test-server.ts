import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

/** Tool definitions served by the test server. */
const TOOLS = [
  {
    name: 'echo',
    description: 'Echo a message back',
    inputSchema: {
      type: 'object',
      properties: { message: { type: 'string', description: 'Message to echo' } },
      required: ['message'],
    },
  },
  {
    name: 'add',
    description: 'Add two numbers',
    inputSchema: {
      type: 'object',
      properties: {
        a: { type: 'number', description: 'First number' },
        b: { type: 'number', description: 'Second number' },
      },
      required: ['a', 'b'],
    },
  },
  {
    name: 'greet',
    description: 'Greet someone by name',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name to greet' },
        formal: { type: 'boolean', description: 'Use formal greeting' },
      },
      required: ['name'],
    },
  },
  {
    name: 'get-items',
    description: 'Return a fixed list of items',
    inputSchema: { type: 'object', properties: {} },
  },
] as const;

type Args = Record<string, unknown>;

/** Dispatch a tool call and return content. */
function callTool(name: string, args: Args): { type: 'text'; text: string }[] {
  switch (name) {
    case 'echo':
      return [{ type: 'text', text: String(args['message'] ?? '') }];
    case 'add': {
      const sum = Number(args['a'] ?? 0) + Number(args['b'] ?? 0);
      return [{ type: 'text', text: String(sum) }];
    }
    case 'greet': {
      const n = String(args['name'] ?? '');
      const f = Boolean(args['formal']);
      return [{ type: 'text', text: f ? `Good day, ${n}.` : `Hi, ${n}!` }];
    }
    case 'get-items':
      return [{ type: 'text', text: JSON.stringify(['apple', 'banana', 'cherry']) }];
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

/**
 * Creates a real MCP Server instance with a fixed set of test tools.
 * Uses plain JSON Schema (no Zod) to avoid TypeScript deep-inference limits.
 */
export function createTestMcpServer(): Server {
  const server = new Server(
    { name: 'test-server', version: '1.0.0' },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS as unknown as Parameters<typeof server.setRequestHandler>[1] extends never
      ? never
      : typeof TOOLS,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args } = req.params;
    const content = callTool(name, (args ?? {}) as Args);
    return { content, isError: false };
  });

  return server;
}
