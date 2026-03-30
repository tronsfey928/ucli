/**
 * End-to-end integration tests: stdio transport
 *
 * The CLI spawns the test server itself via --mcp-stdio, so no in-process
 * server setup is needed. The server is tests/integration/helpers/stdio-server.js
 * (plain JS so it can be executed without TypeScript compilation).
 */

import { runCli, STDIO_SERVER } from './helpers/run-cli';

// Quote the path in case it contains spaces, and escape for shell
const mcpStdio = `node \\"${STDIO_SERVER}\\"`;

function cli(args: string) {
  return runCli(`--mcp-stdio "${mcpStdio}" --no-cache ${args}`);
}

// ---------------------------------------------------------------------------
// Tool discovery
// ---------------------------------------------------------------------------

describe('tool listing (stdio)', () => {
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

describe('tool execution — pretty output (stdio)', () => {
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

describe('tool execution — raw output (stdio)', () => {
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
    const items = JSON.parse(parsed.content[0].text);
    expect(items).toEqual(['apple', 'banana', 'cherry']);
  });
});

// ---------------------------------------------------------------------------
// Tool execution — JMESPath filtering
// ---------------------------------------------------------------------------

describe('tool execution — JMESPath filtering (stdio)', () => {
  it('--jq filters result content text', async () => {
    const { exitCode, stdout } = await cli('echo --message "jq-test" --jq "content[0].text"');
    expect(exitCode).toBe(0);
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

describe('error handling (stdio)', () => {
  it('unknown tool exits with code 1', async () => {
    const { exitCode, stderr } = await cli('nonexistent-tool');
    expect(exitCode).toBe(1);
    expect(stderr).toContain('nonexistent-tool');
  });

  it('missing required argument exits with code 1', async () => {
    const { exitCode } = await cli('echo');
    expect(exitCode).toBe(1);
  });

  it('invalid numeric argument exits with code 1', async () => {
    const { exitCode, stderr } = await cli('add --a nope --b 4');
    expect(exitCode).toBe(1);
    expect(stderr).toContain('Invalid value for numeric parameter');
  });

  it('invalid cache ttl falls back to default behavior', async () => {
    const { exitCode, stdout } = await runCli(
      `--mcp-stdio "node \\"${STDIO_SERVER}\\"" --cache-ttl invalid --list --no-cache`,
    );
    expect(exitCode).toBe(0);
    expect(stdout).toContain('echo');
  });

  it('invalid mcp-stdio command with unclosed quote exits with code 1', async () => {
    const { exitCode, stderr } = await runCli(`--mcp-stdio 'node "bad' --list`);
    expect(exitCode).toBe(1);
    expect(stderr).toContain('Unclosed quote in command');
  });
});

// ---------------------------------------------------------------------------
// Environment variable passthrough
// ---------------------------------------------------------------------------

describe('stdio env passthrough', () => {
  it('passes extra --env vars to child process', async () => {
    // The server doesn't use env vars, but the CLI should not crash when
    // --env is provided for stdio mode.
    const { exitCode, stdout } = await runCli(
      `--mcp-stdio "node \\"${STDIO_SERVER}\\"" --env TEST_VAR=hello --list --no-cache`,
    );
    expect(exitCode).toBe(0);
    expect(stdout).toContain('echo');
  });
});

// ---------------------------------------------------------------------------
// Bake create / use / delete (stdio)
// ---------------------------------------------------------------------------

describe('bake (stdio)', () => {
  const bakeName = `e2e-stdio-${Date.now()}`;

  afterAll(async () => {
    await runCli(`bake delete ${bakeName}`);
  });

  it('creates a bake, uses it via @name, then deletes it', async () => {
    const create = await runCli(
      `bake create ${bakeName} --mcp-stdio "node \\"${STDIO_SERVER}\\"" `,
    );
    expect(create.exitCode).toBe(0);
    expect(create.stdout).toContain(bakeName);

    const list = await runCli('bake list');
    expect(list.exitCode).toBe(0);
    expect(list.stdout).toContain(bakeName);

    const atName = await runCli(`@${bakeName} --list --no-cache`);
    expect(atName.exitCode).toBe(0);
    expect(atName.stdout).toContain('echo');

    const del = await runCli(`bake delete ${bakeName}`);
    expect(del.exitCode).toBe(0);
    expect(del.stdout).toContain(bakeName);
  });
});
