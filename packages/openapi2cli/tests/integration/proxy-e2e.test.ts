/**
 * End-to-end integration test: real Express server → openapi2cli run (proxy mode).
 *
 * Flow:
 *   1. Start an in-process Express server on a random free port.
 *   2. Patch tests/fixtures/test-server-api.json's server URL to the actual port
 *      and write to a temp file.
 *   3. Run `node dist/index.js run --oas <temp-spec> ...` for each scenario.
 *
 * Coverage: GET · POST · PUT · PATCH · DELETE · Bearer auth · enum params
 *   --format yaml/table · --query · --all-pages · SSE · --verbose
 *   --endpoint override · invalid enum · unknown command
 *
 * Run: npm run test:proxy-e2e
 */

import { exec as execCallback, execSync } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as os from 'os';
import * as net from 'net';
import * as fse from 'fs-extra';
import { startServer, TEST_TOKEN, type ServerInstance } from '../server/server';

jest.setTimeout(180000);

const execAsync = promisify(execCallback);
const PROJECT_ROOT = path.join(__dirname, '..', '..');
const DIST_INDEX = path.join(PROJECT_ROOT, 'dist', 'index.js');
const FIXTURE_PATH = path.join(PROJECT_ROOT, 'tests', 'fixtures', 'test-server-api.json');

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

async function exec(cmd: string, extraEnv?: NodeJS.ProcessEnv): Promise<string> {
  const { stdout } = await execAsync(cmd, {
    cwd: PROJECT_ROOT,
    env: { ...process.env, ...extraEnv },
    timeout: 30_000,
  });
  return stdout;
}

async function execWithStderr(cmd: string, extraEnv?: NodeJS.ProcessEnv): Promise<{ stdout: string; stderr: string }> {
  const { stdout, stderr } = await execAsync(cmd, {
    cwd: PROJECT_ROOT,
    env: { ...process.env, ...extraEnv },
    timeout: 30_000,
  });
  return { stdout, stderr };
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('proxy-e2e (openapi2cli run)', () => {
  let server: ServerInstance;
  let patchedSpecPath: string;
  let setupError: Error | null = null;

  // Build the proxy command prefix
  function proxyCmd(args: string): string {
    return `node ${DIST_INDEX} run --oas ${patchedSpecPath} ${args}`;
  }

  // Helper: run a proxy command with Bearer auth (most mutations need it)
  async function proxy(args: string, extraEnv?: NodeJS.ProcessEnv): Promise<string> {
    return exec(proxyCmd(args), extraEnv);
  }

  async function proxyAuth(args: string, token = TEST_TOKEN): Promise<string> {
    return exec(`node ${DIST_INDEX} run --oas ${patchedSpecPath} --bearer ${token} ${args}`);
  }

  // ── Setup / teardown ────────────────────────────────────────────────────────

  beforeAll(async () => {
    try {
      // Build dist if needed
      if (!await fse.pathExists(DIST_INDEX)) {
        console.log('  [proxy-e2e] npm run build...');
        execSync('npm run build', { cwd: PROJECT_ROOT, stdio: 'pipe' });
      }

      const port = await getFreePort();
      server = await startServer(port);

      const rawSpec = await fse.readJSON(FIXTURE_PATH) as Record<string, unknown>;
      (rawSpec['servers'] as Array<{ url: string }>)[0].url = `http://localhost:${port}`;
      patchedSpecPath = path.join(os.tmpdir(), `proxy-e2e-spec-${port}.json`);
      await fse.writeJSON(patchedSpecPath, rawSpec);

      console.log('  [proxy-e2e] ready, port', port);
    } catch (err) {
      setupError = err instanceof Error ? err : new Error(String(err));
      console.error('  [proxy-e2e] setup FAILED:', setupError.message);
    }
  }, 180_000);

  afterAll(async () => {
    await server?.close();
    if (patchedSpecPath) await fse.remove(patchedSpecPath).catch(() => undefined);
  });

  beforeEach(() => server?.resetStore());

  function checkSetup(): void {
    if (setupError) throw new Error(`Setup failed: ${setupError.message}`);
  }

  // ── 1. No operation → list mode ─────────────────────────────────────────────

  it('no operation → lists group names to stdout', async () => {
    checkSetup();
    const out = await proxy('');
    expect(out).toContain('items');
    expect(out).toContain('stream');
    expect(out).toContain('pages');
  });

  // ── 2. --help flags ──────────────────────────────────────────────────────────

  it('run --help → shows proxy-level flags', async () => {
    checkSetup();
    const out = await exec(`node ${DIST_INDEX} run --help`);
    expect(out).toContain('--bearer');
    expect(out).toContain('--api-key');
    expect(out).toContain('--oas');
  });

  it('items get-item --help → shows operation-specific flags', async () => {
    checkSetup();
    const out = await proxy('items get-item --help').catch(() =>
      exec(`${proxyCmd('items get-item --help')} 2>&1`)
    );
    expect(out).toContain('--id');
    expect(out).toContain('--format');
    expect(out).toContain('--query');
  });

  // ── 3. GET requests ──────────────────────────────────────────────────────────

  it('GET /items → array of 3 seed items', async () => {
    checkSetup();
    const data = JSON.parse(await proxy('items list-items')) as unknown[];
    expect(Array.isArray(data)).toBe(true);
    expect(data).toHaveLength(3);
  });

  it('GET /items?status=active → only active items', async () => {
    checkSetup();
    const data = JSON.parse(await proxy('items list-items --status active')) as Array<{ status: string }>;
    expect(data.length).toBeGreaterThan(0);
    expect(data.every(i => i.status === 'active')).toBe(true);
  });

  it('GET /items/:id → correct item by path param', async () => {
    checkSetup();
    const data = JSON.parse(await proxy('items get-item --id 2')) as Record<string, unknown>;
    expect(data['id']).toBe('2');
    expect(data['name']).toBe('Beta');
  });

  it('GET /items/:id with unknown ID → exits non-zero', async () => {
    checkSetup();
    await expect(proxy('items get-item --id 9999')).rejects.toThrow();
  });

  // ── 4. POST (Bearer auth) ────────────────────────────────────────────────────

  it('POST /items with --bearer → 201, returns new item', async () => {
    checkSetup();
    const data = JSON.parse(
      await proxyAuth(`items create-item --data '{"name":"NewWidget","status":"active"}'`)
    ) as Record<string, unknown>;
    expect(data['name']).toBe('NewWidget');
    expect(data['id']).toBeDefined();
  });

  it('POST /items without auth → exits non-zero (401)', async () => {
    checkSetup();
    await expect(
      proxy(`items create-item --data '{"name":"x"}'`)
    ).rejects.toThrow();
  });

  // ── 5. PUT ───────────────────────────────────────────────────────────────────

  it('PUT /items/:id → replaces item fields', async () => {
    checkSetup();
    const data = JSON.parse(
      await proxyAuth(`items replace-item --id 1 --data '{"name":"Alpha-v2","status":"inactive"}'`)
    ) as Record<string, unknown>;
    expect(data['name']).toBe('Alpha-v2');
    expect(data['status']).toBe('inactive');
  });

  // ── 6. PATCH ─────────────────────────────────────────────────────────────────

  it('PATCH /items/:id → partially updates item', async () => {
    checkSetup();
    const data = JSON.parse(
      await proxyAuth(`items update-item --id 2 --data '{"name":"Beta-patched"}'`)
    ) as Record<string, unknown>;
    expect(data['name']).toBe('Beta-patched');
    expect(data['status']).toBe('inactive');
  });

  // ── 7. DELETE ────────────────────────────────────────────────────────────────

  it('DELETE /items/:id → exits 0', async () => {
    checkSetup();
    await expect(proxyAuth('items delete-item --id 3')).resolves.not.toThrow();
  });

  it('DELETE /items/:id → item is gone afterwards', async () => {
    checkSetup();
    await proxyAuth('items delete-item --id 3');
    await expect(proxy('items get-item --id 3')).rejects.toThrow();
  });

  // ── 8. Output formats ─────────────────────────────────────────────────────────

  it('--format yaml → valid YAML with expected keys', async () => {
    checkSetup();
    const out = await proxy('items get-item --id 1 --format yaml');
    expect(out).toMatch(/id:/);
    expect(out).toMatch(/name:/);
    expect(out).toMatch(/status:/);
  });

  it('--format table → non-empty tabular output', async () => {
    checkSetup();
    const out = await proxy('items list-items --format table');
    expect(out.trim().length).toBeGreaterThan(0);
    expect(out).toMatch(/id|name|status/i);
  });

  // ── 9. JMESPath --query ───────────────────────────────────────────────────────

  it('--query extracts a scalar field from an object', async () => {
    checkSetup();
    const out = await proxy('items get-item --id 1 --query name');
    expect(JSON.parse(out)).toBe('Alpha');
  });

  it("--query '[].name' extracts a field list from an array", async () => {
    checkSetup();
    const names = JSON.parse(await proxy("items list-items --query '[].name'")) as unknown[];
    expect(Array.isArray(names)).toBe(true);
    expect(names).toContain('Alpha');
    expect(names).toContain('Beta');
  });

  // ── 10. Pagination --all-pages ────────────────────────────────────────────────

  it('--all-pages follows Link rel="next" headers across pages', async () => {
    checkSetup();
    const data = JSON.parse(await proxy('pages list-pages --all-pages')) as unknown[];
    expect(data).toHaveLength(3);
  });

  // ── 11. SSE streaming ─────────────────────────────────────────────────────────

  it('SSE stream → emits events and exits cleanly', async () => {
    checkSetup();
    const out = await proxy('stream stream-events');
    const lines = out.split('\n').filter(Boolean);
    expect(lines.length).toBeGreaterThanOrEqual(1);
    for (const line of lines) {
      expect(() => JSON.parse(line)).not.toThrow();
    }
    const parsed = lines.map(l => JSON.parse(l) as Record<string, unknown>);
    expect(parsed.every(e => 'seq' in e && 'message' in e)).toBe(true);
  });

  // ── 12. --verbose ─────────────────────────────────────────────────────────────

  it('--verbose prints HTTP method to stderr', async () => {
    checkSetup();
    const { stdout, stderr } = await execWithStderr(
      `${proxyCmd('items get-item --id 1 --verbose')} 2>&1`
    );
    const combined = stdout + stderr;
    expect(combined).toMatch(/GET/i);
  });

  // ── 13. --endpoint override ───────────────────────────────────────────────────

  it('--endpoint overrides the spec base URL', async () => {
    checkSetup();
    // Use the same server with explicit --endpoint — should work identically
    const data = JSON.parse(
      await exec(`node ${DIST_INDEX} run --oas ${patchedSpecPath} --endpoint http://localhost:${server.port} items list-items`)
    ) as unknown[];
    expect(data).toHaveLength(3);
  });

  // ── 14. Enum validation ───────────────────────────────────────────────────────

  it('invalid enum value for --status → exits non-zero', async () => {
    checkSetup();
    await expect(proxy('items list-items --status INVALID')).rejects.toThrow();
  });

  // ── 15. Unknown operation ─────────────────────────────────────────────────────

  it('unknown operation → exits non-zero', async () => {
    checkSetup();
    await expect(proxy('no-such-group')).rejects.toThrow();
  });
});
