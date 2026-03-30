/**
 * Integration test: Generate a github-cli from a curated GitHub API OAS fixture,
 * build it, and verify it works including a real unauthenticated API call.
 *
 * Run with: npm run test:integration
 * Skip network tests: SKIP_NETWORK_TESTS=1 npm run test:integration
 */

import { execSync, ExecSyncOptionsWithStringEncoding } from 'child_process';
import * as path from 'path';
import * as os from 'os';
import * as fse from 'fs-extra';
import { parseOAS } from '../../src/parser/oas-parser';
import { analyzeSchema } from '../../src/analyzer/schema-analyzer';
import { generateProject } from '../../src/generator/command-generator';

jest.setTimeout(180000); // 3 minutes: npm install can be slow

const FIXTURE_PATH = path.join(__dirname, '..', 'fixtures', 'github-api.json');
const SKIP_NETWORK = process.env['SKIP_NETWORK_TESTS'] === '1';

function exec(cmd: string, cwd: string): string {
  const opts: ExecSyncOptionsWithStringEncoding = {
    cwd,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  };
  return execSync(cmd, opts);
}

describe('GitHub CLI integration', () => {
  let outputDir: string;
  let setupError: Error | null = null;

  beforeAll(async () => {
    outputDir = path.join(os.tmpdir(), `cli-openapi-github-test-${Date.now()}`);

    try {
      // Step 1: Parse the GitHub API fixture
      const api = await parseOAS(FIXTURE_PATH);

      // Step 2: Analyze schema
      const structure = analyzeSchema(api, 'github-cli');

      // Step 3: Generate project files
      const files = await generateProject(structure);
      for (const file of files) {
        const dest = path.join(outputDir, file.relativePath);
        await fse.outputFile(dest, file.content, 'utf-8');
      }

      // Make bin executable
      const binPath = path.join(outputDir, 'bin', 'github-cli');
      if (await fse.pathExists(binPath)) {
        await fse.chmod(binPath, 0o755);
      }

      // Step 4: npm install in generated project
      console.log('  [setup] Running npm install in generated project...');
      exec('npm install --prefer-offline 2>/dev/null || npm install', outputDir);

      // Step 5: Build the generated project
      console.log('  [setup] Running npm run build in generated project...');
      exec('npm run build', outputDir);

      console.log('  [setup] Generated project built successfully at:', outputDir);
    } catch (err) {
      setupError = err instanceof Error ? err : new Error(String(err));
      console.error('  [setup] FAILED:', setupError.message);
    }
  });

  afterAll(async () => {
    if (outputDir && await fse.pathExists(outputDir)) {
      await fse.remove(outputDir);
    }
  });

  // Helper to fail fast if setup failed
  function checkSetup(): void {
    if (setupError) {
      throw new Error(`Setup failed: ${setupError.message}`);
    }
  }

  // ── Test 1: Generation ────────────────────────────────────────────────────
  it('setup completes without error', () => {
    expect(setupError).toBeNull();
  });

  // ── Test 2: File structure ────────────────────────────────────────────────
  it('creates all expected files and directories', async () => {
    checkSetup();
    const expectedFiles = [
      'package.json',
      'tsconfig.json',
      'src/index.ts',
      'src/commands/repos.ts',
      'src/commands/users.ts',
      'src/lib/api-client.ts',
      'README.md',
    ];
    for (const f of expectedFiles) {
      expect(await fse.pathExists(path.join(outputDir, f))).toBe(true);
    }
    // bin file exists
    expect(await fse.pathExists(path.join(outputDir, 'bin', 'github-cli'))).toBe(true);
  });

  it('bin/github-cli is executable', async () => {
    checkSetup();
    const binPath = path.join(outputDir, 'bin', 'github-cli');
    const stat = await fse.stat(binPath);
    expect(stat.mode & 0o111).toBeGreaterThan(0);
  });

  // ── Test 3: package.json metadata ────────────────────────────────────────
  it('generated package.json has correct CLI name and metadata', async () => {
    checkSetup();
    const pkg = await fse.readJSON(path.join(outputDir, 'package.json')) as Record<string, unknown>;
    expect(pkg['name']).toBe('github-cli');
    const bin = pkg['bin'] as Record<string, string>;
    expect(bin['github-cli']).toBe('./bin/github-cli');
    const deps = pkg['dependencies'] as Record<string, string>;
    expect(deps['commander']).toBeDefined();
    expect(deps['axios']).toBeDefined();
  });

  // ── Test 4: Generated command content ─────────────────────────────────────
  it('repos command file contains expected operations', async () => {
    checkSetup();
    const content = await fse.readFile(path.join(outputDir, 'src', 'commands', 'repos.ts'), 'utf-8');
    expect(content).toContain('get-repo');
    expect(content).toContain('list-repo-issues');
    expect(content).toContain('create-issue');
  });

  it('users command file contains expected operations', async () => {
    checkSetup();
    const content = await fse.readFile(path.join(outputDir, 'src', 'commands', 'users.ts'), 'utf-8');
    expect(content).toContain('get-user');
    expect(content).toContain('list-user-repos');
  });

  it('repos command uses .choices() for state enum validation', async () => {
    checkSetup();
    const content = await fse.readFile(path.join(outputDir, 'src', 'commands', 'repos.ts'), 'utf-8');
    expect(content).toContain('"open"');
    expect(content).toContain('"closed"');
    expect(content).toContain('"all"');
    expect(content).toContain('.choices(');
  });

  it('api-client.ts injects Bearer token from API_TOKEN env var', async () => {
    checkSetup();
    const content = await fse.readFile(path.join(outputDir, 'src', 'lib', 'api-client.ts'), 'utf-8');
    expect(content).toContain('API_TOKEN');
    expect(content).toContain('Bearer');
  });

  it('generated index.ts registers both repos and users command groups', async () => {
    checkSetup();
    const content = await fse.readFile(path.join(outputDir, 'src', 'index.ts'), 'utf-8');
    expect(content).toContain('registerReposCommands');
    expect(content).toContain('registerUsersCommands');
  });

  // ── Test 5: Build output ──────────────────────────────────────────────────
  it('npm run build produces dist/index.js', async () => {
    checkSetup();
    expect(await fse.pathExists(path.join(outputDir, 'dist', 'index.js'))).toBe(true);
  });

  it('npm run build produces compiled command files', async () => {
    checkSetup();
    expect(await fse.pathExists(path.join(outputDir, 'dist', 'commands', 'repos.js'))).toBe(true);
    expect(await fse.pathExists(path.join(outputDir, 'dist', 'commands', 'users.js'))).toBe(true);
  });

  // ── Test 6: CLI --help output ─────────────────────────────────────────────
  it('--help shows CLI name and command groups', () => {
    checkSetup();
    const output = exec('node dist/index.js --help', outputDir);
    expect(output).toContain('github-cli');
    expect(output).toContain('repos');
    expect(output).toContain('users');
  });

  it('repos --help lists all expected sub-commands', () => {
    checkSetup();
    const output = exec('node dist/index.js repos --help', outputDir);
    expect(output).toContain('get-repo');
    expect(output).toContain('list-repo-issues');
    expect(output).toContain('create-issue');
  });

  it('users --help lists all expected sub-commands', () => {
    checkSetup();
    const output = exec('node dist/index.js users --help', outputDir);
    expect(output).toContain('get-user');
    expect(output).toContain('list-user-repos');
  });

  it('sub-command help shows options', () => {
    checkSetup();
    const output = exec('node dist/index.js repos list-repo-issues --help', outputDir);
    expect(output).toContain('--owner');
    expect(output).toContain('--repo');
    expect(output).toContain('--state');
    // enum choices displayed in help
    expect(output).toMatch(/open|closed|all/);
  });

  // ── Test 7: Real API call (network) ───────────────────────────────────────
  it('GET /repos/octocat/Hello-World returns valid GitHub data', () => {
    if (SKIP_NETWORK) {
      console.log('  [skipped] SKIP_NETWORK_TESTS=1');
      return;
    }
    checkSetup();

    const output = exec(
      'node dist/index.js repos get-repo --owner octocat --repo Hello-World',
      outputDir
    );

    let data: Record<string, unknown>;
    expect(() => { data = JSON.parse(output) as Record<string, unknown>; }).not.toThrow();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(data!['name']).toBe('Hello-World');
    expect(data!['full_name']).toBe('octocat/Hello-World');
    expect(typeof data!['id']).toBe('number');
  });

  it('GET /users/octocat returns valid GitHub user data', () => {
    if (SKIP_NETWORK) {
      console.log('  [skipped] SKIP_NETWORK_TESTS=1');
      return;
    }
    checkSetup();

    const output = exec(
      'node dist/index.js users get-user --username octocat',
      outputDir
    );

    let data: Record<string, unknown>;
    expect(() => { data = JSON.parse(output) as Record<string, unknown>; }).not.toThrow();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(data!['login']).toBe('octocat');
    expect(typeof data!['public_repos']).toBe('number');
  });

  // ── Test 8: Enum validation ───────────────────────────────────────────────
  it('invalid enum value for --state causes CLI to exit with error', () => {
    checkSetup();
    expect(() => {
      exec(
        'node dist/index.js repos list-repo-issues --owner octocat --repo Hello-World --state INVALID_VALUE',
        outputDir
      );
    }).toThrow(); // execSync throws when exit code != 0
  });
});
