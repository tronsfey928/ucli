/**
 * End-to-end integration tests: SSE transport
 *
 * Starts a real Express + SSE MCP server on a random port,
 * then exercises the compiled CLI binary against it.
 */

import * as http from 'http';
import express from 'express';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { createTestMcpServer } from './helpers/test-server';
import { runCli } from './helpers/run-cli';

let httpServer: http.Server;
let serverUrl: string;

beforeAll((done) => {
  const app = express();
  app.use(express.json());

  const transports: Record<string, SSEServerTransport> = {};

  // Each GET /sse connection gets its own server+transport pair
  app.get('/sse', async (req, res) => {
    const server = createTestMcpServer();
    const transport = new SSEServerTransport('/messages', res);
    transports[transport.sessionId] = transport;
    transport.onclose = () => {
      delete transports[transport.sessionId];
    };
    await server.connect(transport);
  });

  app.post('/messages', async (req, res) => {
    const sid = req.query['sessionId'] as string;
    const transport = transports[sid];
    if (!transport) {
      res.status(404).json({ error: 'Unknown session' });
      return;
    }
    await transport.handlePostMessage(req, res, req.body);
  });

  httpServer = http.createServer(app);
  httpServer.listen(0, '127.0.0.1', () => {
    const addr = httpServer.address() as { port: number };
    serverUrl = `http://127.0.0.1:${addr.port}/sse`;
    done();
  });
});

afterAll((done) => {
  httpServer.close(done);
});

// Shared helper for this suite
function cli(args: string) {
  return runCli(`--mcp "${serverUrl}" --no-cache ${args}`);
}

// ---------------------------------------------------------------------------
// Tool discovery
// ---------------------------------------------------------------------------

describe('tool listing (SSE)', () => {
  it('lists all registered tools', async () => {
    const { exitCode, stdout } = await cli('--list');
    expect(exitCode).toBe(0);
    expect(stdout).toContain('echo');
    expect(stdout).toContain('add');
    expect(stdout).toContain('greet');
    expect(stdout).toContain('get-items');
  });
});

// ---------------------------------------------------------------------------
// Tool execution — default (pretty) output
// ---------------------------------------------------------------------------

describe('tool execution — pretty output (SSE)', () => {
  it('echo: returns the message', async () => {
    const { exitCode, stdout } = await cli('echo --message "hello world"');
    expect(exitCode).toBe(0);
    expect(stdout.trim()).toBe('hello world');
  });

  it('add: returns the sum', async () => {
    const { exitCode, stdout } = await cli('add --a 3 --b 4');
    expect(exitCode).toBe(0);
    expect(stdout.trim()).toBe('7');
  });

  it('greet: informal greeting', async () => {
    const { exitCode, stdout } = await cli('greet --name Alice');
    expect(exitCode).toBe(0);
    expect(stdout.trim()).toBe('Hi, Alice!');
  });

  it('greet: formal greeting', async () => {
    const { exitCode, stdout } = await cli('greet --name Alice --formal');
    expect(exitCode).toBe(0);
    expect(stdout.trim()).toBe('Good day, Alice.');
  });

  it('get-items: returns list text', async () => {
    const { exitCode, stdout } = await cli('get-items');
    expect(exitCode).toBe(0);
    expect(stdout).toContain('apple');
    expect(stdout).toContain('banana');
    expect(stdout).toContain('cherry');
  });
});

// ---------------------------------------------------------------------------
// Tool execution — raw JSON output
// ---------------------------------------------------------------------------

describe('tool execution — raw output (SSE)', () => {
  it('echo --raw: returns full JSON result', async () => {
    const { exitCode, stdout } = await cli('echo --message "raw-test" --raw');
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed).toHaveProperty('content');
    expect(parsed.content[0].text).toBe('raw-test');
  });

  it('get-items --raw: result content is JSON-serialised array', async () => {
    const { exitCode, stdout } = await cli('get-items --raw');
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    const text = parsed.content[0].text;
    const items = JSON.parse(text);
    expect(items).toEqual(['apple', 'banana', 'cherry']);
  });
});

// ---------------------------------------------------------------------------
// Tool execution — JMESPath filtering
// ---------------------------------------------------------------------------

describe('tool execution — JMESPath filtering (SSE)', () => {
  it('--jq filters result content type', async () => {
    const { exitCode, stdout } = await cli('echo --message "jq-test" --jq "content[0].text"');
    expect(exitCode).toBe(0);
    // JMESPath extracts the string, then JSON.stringify wraps it in quotes
    expect(stdout).toContain('jq-test');
  });

  it('--raw --jq: applies JMESPath then emits raw JSON', async () => {
    const { exitCode, stdout } = await cli('echo --message "jq-raw" --raw --jq "content[0].text"');
    expect(exitCode).toBe(0);
    expect(JSON.parse(stdout)).toBe('jq-raw');
  });
});

// ---------------------------------------------------------------------------
// Error cases
// ---------------------------------------------------------------------------

describe('error handling (SSE)', () => {
  it('unknown tool exits with code 1', async () => {
    const { exitCode, stderr } = await cli('nonexistent-tool');
    expect(exitCode).toBe(1);
    expect(stderr).toContain('nonexistent-tool');
  });

  it('missing required argument exits with code 1', async () => {
    const { exitCode } = await cli('echo');
    expect(exitCode).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Cache behaviour
// ---------------------------------------------------------------------------

describe('cache (SSE)', () => {
  it('--no-cache still returns correct tool list', async () => {
    const { exitCode, stdout } = await cli('--list');
    expect(exitCode).toBe(0);
    expect(stdout).toContain('echo');
  });
});

// ---------------------------------------------------------------------------
// Bake create / use / delete
// ---------------------------------------------------------------------------

describe('bake (SSE)', () => {
  const bakeName = `e2e-sse-${Date.now()}`;

  afterAll(async () => {
    // Best-effort cleanup
    await runCli(`bake delete ${bakeName}`);
  });

  it('creates a bake, uses it via @name, then deletes it', async () => {
    // Create
    const create = await runCli(`bake create ${bakeName} --mcp "${serverUrl}"`);
    expect(create.exitCode).toBe(0);
    expect(create.stdout).toContain(bakeName);

    // List bakes
    const list = await runCli('bake list');
    expect(list.exitCode).toBe(0);
    expect(list.stdout).toContain(bakeName);

    // Use via @name shortcut
    const atName = await runCli(`@${bakeName} --list --no-cache`);
    expect(atName.exitCode).toBe(0);
    expect(atName.stdout).toContain('echo');

    // Delete
    const del = await runCli(`bake delete ${bakeName}`);
    expect(del.exitCode).toBe(0);
    expect(del.stdout).toContain(bakeName);
  });
});
