/**
 * End-to-end integration test: real Express server → generated CLI.
 *
 * Flow:
 *   1. Start an in-process Express server on a random free port.
 *   2. Generate a typed CLI project from tests/fixtures/test-server-api.json
 *      (server URL is patched to the actual port at generation time).
 *   3. npm install + npm run build the generated project.
 *   4. Spawn the compiled CLI binary for each scenario.
 *
 * Coverage:
 *   GET / POST / PUT / PATCH / DELETE · Bearer auth · enum query params
 *   --format yaml / table · --query (JMESPath) · --all-pages (pagination)
 *   SSE streaming · enum validation errors · --verbose · --help output
 *
 * Run: npm run test:e2e
 * Also run automatically via prepublishOnly.
 *
 * IMPORTANT: uses async exec (not execSync) so the Node.js event loop stays
 * free to service the in-process Express server while CLI child processes run.
 */

import { exec as execCallback, execSync, ExecSyncOptionsWithStringEncoding } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as os from 'os';
import * as net from 'net';
import * as fse from 'fs-extra';
import { parseOAS } from '../../src/parser/oas-parser';
import { analyzeSchema } from '../../src/analyzer/schema-analyzer';
import { generateProject } from '../../src/generator/command-generator';
import { startServer, TEST_TOKEN, type ServerInstance } from '../server/server';

jest.setTimeout(180000);

const execAsync = promisify(execCallback);
const FIXTURE_PATH = path.join(__dirname, '..', 'fixtures', 'test-server-api.json');

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.listen(0, () => {
      const addr = s.address() as net.AddressInfo;
      s.close(() => resolve(addr.port));
    });
    s.on('error', reject);
  });
}

/** Async exec — keeps the event loop free so the in-process Express server can respond. */
async function exec(cmd: string, cwd: string, env?: NodeJS.ProcessEnv): Promise<string> {
  const { stdout } = await execAsync(cmd, {
    cwd,
    env: { ...process.env, ...env },
    timeout: 30_000,
  });
  return stdout;
}

/** Synchronous exec for setup steps (npm install / npm run build) that don't hit the test server. */
function execBuild(cmd: string, cwd: string): void {
  const opts: ExecSyncOptionsWithStringEncoding = {
    cwd,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env },
    timeout: 120_000,
  };
  execSync(cmd, opts);
}

// ─── Suite ────────────────────────────────────────────────────────────────────
describe('Express server e2e', () => {
  let server: ServerInstance;
  let outputDir: string;
  let setupError: Error | null = null;

  // Run CLI binary in the generated project dir, injecting the test Bearer token.
  // --endpoint is passed explicitly so the CLI always hits the live test server.
  async function cli(args: string, extraEnv?: NodeJS.ProcessEnv): Promise<string> {
    return exec(
      `node dist/index.js --endpoint http://localhost:${server.port} ${args}`,
      outputDir,
      { TEST_CLI_TOKEN: TEST_TOKEN, ...extraEnv },
    );
  }

  // ── Setup / teardown ───────────────────────────────────────────────────────
  beforeAll(async () => {
    try {
      const port = await getFreePort();
      server = await startServer(port);

      // Patch the spec's placeholder server URL to the actual port, then generate.
      const rawSpec = await fse.readJSON(FIXTURE_PATH) as Record<string, unknown>;
      (rawSpec['servers'] as Array<{ url: string }>)[0].url = `http://localhost:${port}`;
      const patchedSpecPath = path.join(os.tmpdir(), `test-server-api-${port}.json`);
      await fse.writeJSON(patchedSpecPath, rawSpec);

      const api = await parseOAS(patchedSpecPath);
      const structure = analyzeSchema(api, 'test-cli');
      const files = await generateProject(structure);

      outputDir = path.join(os.tmpdir(), `cli-openapi-e2e-${Date.now()}`);
      for (const file of files) {
        await fse.outputFile(path.join(outputDir, file.relativePath), file.content, 'utf-8');
      }
      const binPath = path.join(outputDir, 'bin', 'test-cli');
      if (await fse.pathExists(binPath)) await fse.chmod(binPath, 0o755);

      console.log('  [e2e] npm install...');
      execBuild('npm install --prefer-offline 2>/dev/null || npm install', outputDir);
      console.log('  [e2e] npm run build...');
      execBuild('npm run build', outputDir);
      console.log('  [e2e] ready at', outputDir);
    } catch (err) {
      setupError = err instanceof Error ? err : new Error(String(err));
      console.error('  [e2e] setup FAILED:', setupError.message);
    }
  }, 180_000);

  afterAll(async () => {
    await server?.close();
    if (outputDir) await fse.remove(outputDir);
  });

  // Reset the in-memory store before every test so mutations don't bleed across.
  beforeEach(() => server?.resetStore());

  function checkSetup(): void {
    if (setupError) throw new Error(`Setup failed: ${setupError.message}`);
  }

  // ── 1. Setup ───────────────────────────────────────────────────────────────
  it('setup: project generates, installs, and builds without error', () => {
    expect(setupError).toBeNull();
  });

  it('setup: all expected source files exist', async () => {
    checkSetup();
    const files = [
      'package.json', 'tsconfig.json',
      'src/index.ts', 'src/commands/items.ts', 'src/commands/stream.ts',
      'src/commands/pages.ts', 'src/lib/api-client.ts',
      'README.md', 'README.zh.md', 'SKILL.md',
    ];
    for (const f of files) {
      expect(await fse.pathExists(path.join(outputDir, f))).toBe(true);
    }
  });

  it('setup: generated package.json references eventsource-parser', async () => {
    checkSetup();
    const pkg = await fse.readJSON(path.join(outputDir, 'package.json')) as Record<string, unknown>;
    const deps = pkg['dependencies'] as Record<string, string>;
    expect(deps['eventsource-parser']).toBeDefined();
  });

  // ── 2. GET requests ────────────────────────────────────────────────────────
  it('GET /items → array of 3 seed items', async () => {
    checkSetup();
    const data = JSON.parse(await cli('items list-items')) as unknown[];
    expect(Array.isArray(data)).toBe(true);
    expect(data).toHaveLength(3);
  });

  it('GET /items?status=active → only active items', async () => {
    checkSetup();
    const data = JSON.parse(await cli('items list-items --status active')) as Array<{ status: string }>;
    expect(data.length).toBeGreaterThan(0);
    expect(data.every(i => i.status === 'active')).toBe(true);
  });

  it('GET /items?status=inactive → only inactive items', async () => {
    checkSetup();
    const data = JSON.parse(await cli('items list-items --status inactive')) as Array<{ status: string }>;
    expect(data.every(i => i.status === 'inactive')).toBe(true);
  });

  it('GET /items/:id → correct item by path param', async () => {
    checkSetup();
    const data = JSON.parse(await cli('items get-item --id 2')) as Record<string, unknown>;
    expect(data['id']).toBe('2');
    expect(data['name']).toBe('Beta');
  });

  it('GET /items/:id with unknown ID → CLI exits non-zero', async () => {
    checkSetup();
    await expect(cli('items get-item --id 9999')).rejects.toThrow();
  });

  // ── 3. POST (with Bearer auth) ─────────────────────────────────────────────
  it('POST /items with auth → 201, returns new item', async () => {
    checkSetup();
    const data = JSON.parse(
      await cli(`items create-item --data '{"name":"NewWidget","status":"active"}'`)
    ) as Record<string, unknown>;
    expect(data['name']).toBe('NewWidget');
    expect(data['id']).toBeDefined();
  });

  it('POST /items without auth token → CLI exits non-zero (401)', async () => {
    checkSetup();
    await expect(
      cli(`items create-item --data '{"name":"x"}'`, { TEST_CLI_TOKEN: '' })
    ).rejects.toThrow();
  });

  // ── 4. PUT ─────────────────────────────────────────────────────────────────
  it('PUT /items/:id → replaces item fields', async () => {
    checkSetup();
    const data = JSON.parse(
      await cli(`items replace-item --id 1 --data '{"name":"Alpha-v2","status":"inactive"}'`)
    ) as Record<string, unknown>;
    expect(data['name']).toBe('Alpha-v2');
    expect(data['status']).toBe('inactive');
    expect(data['id']).toBe('1');
  });

  // ── 5. PATCH ──────────────────────────────────────────────────────────────
  it('PATCH /items/:id → partially updates item', async () => {
    checkSetup();
    const data = JSON.parse(
      await cli(`items update-item --id 2 --data '{"name":"Beta-patched"}'`)
    ) as Record<string, unknown>;
    expect(data['name']).toBe('Beta-patched');
    expect(data['id']).toBe('2');
    // status unchanged
    expect(data['status']).toBe('inactive');
  });

  // ── 6. DELETE ─────────────────────────────────────────────────────────────
  it('DELETE /items/:id → exits 0 (204 No Content)', async () => {
    checkSetup();
    await expect(cli('items delete-item --id 3')).resolves.not.toThrow();
  });

  it('DELETE /items/:id → item is gone afterwards', async () => {
    checkSetup();
    await cli('items delete-item --id 3');
    await expect(cli('items get-item --id 3')).rejects.toThrow();
  });

  // ── 7. Output formats ──────────────────────────────────────────────────────
  it('--format yaml → valid YAML with expected keys', async () => {
    checkSetup();
    const out = await cli('items get-item --id 1 --format yaml');
    expect(out).toMatch(/id:/);
    expect(out).toMatch(/name:/);
    expect(out).toMatch(/status:/);
  });

  it('--format table → non-empty tabular output', async () => {
    checkSetup();
    const out = await cli('items list-items --format table');
    expect(out.trim().length).toBeGreaterThan(0);
    expect(out).toMatch(/id|name|status/i);
  });

  // ── 8. JMESPath --query ────────────────────────────────────────────────────
  it('--query extracts a scalar field from an object', async () => {
    checkSetup();
    const out = await cli('items get-item --id 1 --query name');
    expect(JSON.parse(out)).toBe('Alpha');
  });

  it('--query extracts a field list from an array', async () => {
    checkSetup();
    const names = JSON.parse(await cli("items list-items --query '[].name'")) as unknown[];
    expect(Array.isArray(names)).toBe(true);
    expect(names).toContain('Alpha');
    expect(names).toContain('Beta');
  });

  // ── 9. Pagination --all-pages ──────────────────────────────────────────────
  it('--all-pages follows Link rel="next" headers across pages', async () => {
    checkSetup();
    const data = JSON.parse(await cli('pages list-pages --all-pages')) as unknown[];
    // Page 1 has 2 items, page 2 has 1 item → 3 total
    expect(data).toHaveLength(3);
  });

  // ── 10. SSE streaming ──────────────────────────────────────────────────────
  it('SSE stream → emits events and exits cleanly', async () => {
    checkSetup();
    const out = await cli('stream stream-events');
    const lines = out.split('\n').filter(Boolean);
    // Server emits 3 events before [DONE]; each should be parseable JSON
    expect(lines.length).toBeGreaterThanOrEqual(1);
    for (const line of lines) {
      expect(() => JSON.parse(line)).not.toThrow();
    }
    // All events should have seq and message fields
    const parsed = lines.map(l => JSON.parse(l) as Record<string, unknown>);
    expect(parsed.every(e => 'seq' in e && 'message' in e)).toBe(true);
  });

  // ── 11. Enum validation ────────────────────────────────────────────────────
  it('invalid enum value for --status → CLI exits non-zero', async () => {
    checkSetup();
    await expect(cli('items list-items --status INVALID')).rejects.toThrow();
  });

  // ── 12. --verbose ──────────────────────────────────────────────────────────
  it('--verbose prints HTTP method to stderr', async () => {
    checkSetup();
    // Merge stderr into stdout via shell redirection so exec can capture it.
    const out = await exec(
      `node dist/index.js --endpoint http://localhost:${server.port} items get-item --id 1 --verbose 2>&1`,
      outputDir,
      { TEST_CLI_TOKEN: TEST_TOKEN },
    );
    expect(out).toMatch(/GET/i);
  });

  // ── 13. --help output ──────────────────────────────────────────────────────
  it('top-level --help lists all command groups', async () => {
    checkSetup();
    const out = await exec('node dist/index.js --help', outputDir);
    expect(out).toContain('items');
    expect(out).toContain('stream');
    expect(out).toContain('pages');
  });

  it('items --help lists all subcommands', async () => {
    checkSetup();
    const out = await exec('node dist/index.js items --help', outputDir);
    expect(out).toContain('list-items');
    expect(out).toContain('create-item');
    expect(out).toContain('get-item');
    expect(out).toContain('replace-item');
    expect(out).toContain('update-item');
    expect(out).toContain('delete-item');
  });

  it('items list-items --help shows enum choices for --status', async () => {
    checkSetup();
    const out = await exec('node dist/index.js items list-items --help', outputDir);
    expect(out).toContain('--status');
    expect(out).toMatch(/active|inactive|archived/);
  });
});
