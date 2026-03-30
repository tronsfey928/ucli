import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs-extra';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp2cli-bake-test-'));

// Mock os.homedir() so bake files go to tmpDir
jest.mock('os', () => ({
  ...jest.requireActual<typeof os>('os'),
  homedir: () => tmpDir,
}));

import { createBake, getBake, listBakes, deleteBake, configToArgs } from '../src/bake';
import { McpServerConfig } from '../src/types/index';

afterAll(() => {
  fs.removeSync(tmpDir);
});

beforeEach(async () => {
  // Reset bake store before each test
  await fs.remove(path.join(tmpDir, '.mcp2cli', 'bakes.json'));
});

describe('bake operations', () => {
  test('returns empty store and warns on corrupted bakes.json', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const bakeFile = path.join(tmpDir, '.mcp2cli', 'bakes.json');
    await fs.ensureDir(path.dirname(bakeFile));
    await fs.writeFile(bakeFile, 'CORRUPTED JSON');
    const bakes = await listBakes();
    expect(bakes).toEqual([]);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('could not read bake store'));
    warnSpy.mockRestore();
  });

  test('createBake and getBake (http)', async () => {
    const config: McpServerConfig = {
      type: 'http',
      url: 'https://example.com/mcp',
      headers: { Authorization: 'Bearer TOKEN' },
    };
    await createBake('test-http', config);
    const entry = await getBake('test-http');
    expect(entry).not.toBeNull();
    expect(entry!.name).toBe('test-http');
    expect(entry!.config.type).toBe('http');
    if (entry!.config.type === 'http') {
      expect(entry!.config.url).toBe('https://example.com/mcp');
    }
  });

  test('createBake and getBake (stdio)', async () => {
    const config: McpServerConfig = {
      type: 'stdio',
      command: 'node server.js',
      env: { API_KEY: 'secret' },
    };
    await createBake('test-stdio', config);
    const entry = await getBake('test-stdio');
    expect(entry).not.toBeNull();
    expect(entry!.config.type).toBe('stdio');
    if (entry!.config.type === 'stdio') {
      expect(entry!.config.command).toBe('node server.js');
      expect(entry!.config.env?.API_KEY).toBe('secret');
    }
  });

  test('getBake returns null for unknown name', async () => {
    const entry = await getBake('does-not-exist');
    expect(entry).toBeNull();
  });

  test('listBakes returns all bakes', async () => {
    await createBake('alpha', { type: 'http', url: 'https://a.com/mcp' });
    await createBake('beta', { type: 'stdio', command: 'node b.js' });
    const bakes = await listBakes();
    const names = bakes.map((b) => b.name);
    expect(names).toContain('alpha');
    expect(names).toContain('beta');
  });

  test('deleteBake removes the entry', async () => {
    await createBake('to-delete', { type: 'http', url: 'https://x.com/mcp' });
    const deleted = await deleteBake('to-delete');
    expect(deleted).toBe(true);
    const entry = await getBake('to-delete');
    expect(entry).toBeNull();
  });

  test('deleteBake returns false for nonexistent entry', async () => {
    const deleted = await deleteBake('nope');
    expect(deleted).toBe(false);
  });

  test('createBake overwrites existing entry', async () => {
    await createBake('overwrite', { type: 'http', url: 'https://old.com/mcp' });
    await createBake('overwrite', { type: 'http', url: 'https://new.com/mcp' });
    const entry = await getBake('overwrite');
    if (entry!.config.type === 'http') {
      expect(entry!.config.url).toBe('https://new.com/mcp');
    }
  });

  test('getBake returns null for prototype property names', async () => {
    expect(await getBake('toString')).toBeNull();
    expect(await getBake('constructor')).toBeNull();
    expect(await getBake('__proto__')).toBeNull();
    expect(await getBake('hasOwnProperty')).toBeNull();
  });

  test('deleteBake returns false for prototype property names', async () => {
    expect(await deleteBake('toString')).toBe(false);
    expect(await deleteBake('constructor')).toBe(false);
    expect(await deleteBake('__proto__')).toBe(false);
  });

  test('createBake rejects reserved names', async () => {
    const config: McpServerConfig = { type: 'http', url: 'https://example.com/mcp' };
    await expect(createBake('__proto__', config)).rejects.toThrow('is reserved');
    await expect(createBake('constructor', config)).rejects.toThrow('is reserved');
    await expect(createBake('toString', config)).rejects.toThrow('is reserved');
  });

  test('createBake rejects empty or whitespace-only names', async () => {
    const config: McpServerConfig = { type: 'http', url: 'https://example.com/mcp' };
    await expect(createBake('', config)).rejects.toThrow('cannot be empty');
    await expect(createBake('   ', config)).rejects.toThrow('cannot be empty');
  });

  test('createBake rejects names with special characters', async () => {
    const config: McpServerConfig = { type: 'http', url: 'https://example.com/mcp' };
    await expect(createBake('my server', config)).rejects.toThrow('invalid');
    await expect(createBake('name@host', config)).rejects.toThrow('invalid');
    await expect(createBake('foo/bar', config)).rejects.toThrow('invalid');
    await expect(createBake('.hidden', config)).rejects.toThrow('invalid');
  });

  test('createBake accepts valid names with hyphens and underscores', async () => {
    const config: McpServerConfig = { type: 'http', url: 'https://example.com/mcp' };
    await createBake('my-server', config);
    await createBake('my_server', config);
    await createBake('server123', config);
    const bakes = await listBakes();
    const names = bakes.map((b) => b.name);
    expect(names).toContain('my-server');
    expect(names).toContain('my_server');
    expect(names).toContain('server123');
  });
});

describe('configToArgs', () => {
  test('http config produces --mcp flag', () => {
    const config: McpServerConfig = { type: 'http', url: 'https://example.com/mcp' };
    const args = configToArgs(config);
    expect(args[0]).toBe('--mcp');
    expect(args[1]).toBe('https://example.com/mcp');
  });

  test('http config with headers produces --header flags', () => {
    const config: McpServerConfig = {
      type: 'http',
      url: 'https://example.com/mcp',
      headers: { Authorization: 'Bearer X', 'X-Foo': 'bar' },
    };
    const args = configToArgs(config);
    expect(args).toContain('--header');
    const headerIdx = args.indexOf('--header');
    expect(args[headerIdx + 1]).toMatch(/^Authorization:/);
  });

  test('stdio config produces --mcp-stdio flag', () => {
    const config: McpServerConfig = { type: 'stdio', command: 'node server.js' };
    const args = configToArgs(config);
    expect(args[0]).toBe('--mcp-stdio');
    expect(args[1]).toBe('node server.js');
  });

  test('stdio config with env produces --env flags', () => {
    const config: McpServerConfig = {
      type: 'stdio',
      command: 'node server.js',
      env: { API_KEY: 'secret' },
    };
    const args = configToArgs(config);
    expect(args).toContain('--env');
    const envIdx = args.indexOf('--env');
    expect(args[envIdx + 1]).toBe('API_KEY=secret');
  });
});
