// Plain JS stdio MCP server used as a child process in integration tests.
// Deliberately plain JS (not TypeScript) so it can be spawned without compilation.
// Node.js resolves @modelcontextprotocol/sdk from the project's node_modules.
'use strict';

const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { z } = require('zod');

async function main() {
  const server = new McpServer({ name: 'test-server', version: '1.0.0' });

  server.tool(
    'echo',
    'Echo a message back',
    { message: z.string().describe('Message to echo') },
    async ({ message }) => ({ content: [{ type: 'text', text: message }] }),
  );

  server.tool(
    'add',
    'Add two numbers',
    { a: z.number().describe('First number'), b: z.number().describe('Second number') },
    async ({ a, b }) => ({ content: [{ type: 'text', text: String(a + b) }] }),
  );

  server.tool(
    'greet',
    'Greet someone by name',
    {
      name: z.string().describe('Name to greet'),
      formal: z.boolean().optional().describe('Use formal greeting'),
    },
    async ({ name, formal }) => ({
      content: [{ type: 'text', text: formal ? `Good day, ${name}.` : `Hi, ${name}!` }],
    }),
  );

  server.tool(
    'get-items',
    'Return a fixed list of items',
    {},
    async () => ({
      content: [{ type: 'text', text: JSON.stringify(['apple', 'banana', 'cherry']) }],
    }),
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  process.stderr.write(String(err) + '\n');
  process.exit(1);
});
