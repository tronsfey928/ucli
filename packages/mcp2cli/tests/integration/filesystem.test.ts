/**
 * End-to-end integration test using the real @modelcontextprotocol/server-filesystem
 * package.  The server is installed as a devDependency and launched as a stdio
 * child process, giving us confidence that the CLI works with a genuine third-
 * party MCP server implementation (not just the hand-rolled test fixture).
 *
 * Tests cover:
 *  - Tool discovery (list_directory, read_file, etc. must appear)
 *  - list_directory: read an actual directory
 *  - read_file: read an actual file written by the test
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { runCli, ROOT } from './helpers/run-cli';

// Resolve the binary shipped with the installed package so no network access
// is needed during the test run.
const SERVER_BIN = path.join(ROOT, 'node_modules', '.bin', 'mcp-server-filesystem');

// Allowed directory exposed to the filesystem server.
const ALLOW_DIR = os.tmpdir();

// The command given to --mcp-stdio: the full command string with properly
// shell-escaped paths so that parseCommand can split them correctly.
// Pattern follows the same escaping used in stdio.test.ts.
const mcpStdio = `\\"${SERVER_BIN}\\" \\"${ALLOW_DIR}\\"`;

function cli(args: string) {
  return runCli(`--mcp-stdio "${mcpStdio}" --no-cache ${args}`);
}

// ---------------------------------------------------------------------------
// Tool discovery
// ---------------------------------------------------------------------------

describe('filesystem server — tool listing (stdio)', () => {
  it('lists the filesystem tools exposed by the server', async () => {
    const { exitCode, stdout } = await cli('--list');
    expect(exitCode).toBe(0);
    // Core tools that every version of the filesystem server provides.
    expect(stdout).toContain('read_file');
    expect(stdout).toContain('list_directory');
    expect(stdout).toContain('list_allowed_directories');
  });
});

// ---------------------------------------------------------------------------
// list_directory
// ---------------------------------------------------------------------------

describe('filesystem server — list_directory (stdio)', () => {
  it('returns a directory listing for the allowed dir', async () => {
    const { exitCode, stdout, stderr } = await cli(`list_directory --path "${ALLOW_DIR}"`);
    // The tool should succeed and return something (even an empty directory is ok).
    expect(exitCode).toBe(0);
    // The output should not be empty – at minimum an empty-dir marker or entries.
    expect(stdout.length + stderr.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// read_file
// ---------------------------------------------------------------------------

describe('filesystem server — read_file (stdio)', () => {
  const tmpFile = path.join(ALLOW_DIR, `mcp2cli-fs-test-${Date.now()}.txt`);
  const fileContent = 'hello from mcp2cli filesystem integration test';

  beforeAll(() => {
    fs.writeFileSync(tmpFile, fileContent, 'utf8');
  });

  afterAll(() => {
    try {
      fs.unlinkSync(tmpFile);
    } catch {
      // best-effort cleanup
    }
  });

  it('reads the content of a file in the allowed directory', async () => {
    const { exitCode, stdout } = await cli(`read_file --path "${tmpFile}"`);
    expect(exitCode).toBe(0);
    expect(stdout).toContain(fileContent);
  });
});

// ---------------------------------------------------------------------------
// list_allowed_directories
// ---------------------------------------------------------------------------

describe('filesystem server — list_allowed_directories (stdio)', () => {
  it('returns the directory the server was started with', async () => {
    const { exitCode, stdout } = await cli('list_allowed_directories');
    expect(exitCode).toBe(0);
    // The allowed dir path should appear somewhere in the output.
    expect(stdout).toContain(ALLOW_DIR);
  });
});
