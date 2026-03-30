import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs-extra';

// Use a fresh temp dir for every test run
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp2cli-cache-test-'));

// Mock os.homedir() so cache files go to tmpDir
jest.mock('os', () => ({
  ...jest.requireActual<typeof os>('os'),
  homedir: () => tmpDir,
}));

import { getCachedTools, setCachedTools, invalidateCache } from '../src/cache';
import { McpServerConfig, ToolDefinition } from '../src/types/index';

afterAll(() => {
  fs.removeSync(tmpDir);
});

const httpConfig: McpServerConfig = { type: 'http', url: 'https://example.com/mcp' };
const stdioConfig: McpServerConfig = { type: 'stdio', command: 'node server.js' };

const sampleTools: ToolDefinition[] = [
  {
    name: 'search',
    description: 'Search',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
    },
  },
];

describe('cache operations', () => {
  beforeEach(async () => {
    // Clean up cache dir before each test for isolation
    await fs.remove(path.join(tmpDir, '.mcp2cli', 'cache'));
  });

  test('returns null on cache miss', async () => {
    const result = await getCachedTools(httpConfig, 3600);
    expect(result).toBeNull();
  });

  test('setCachedTools and getCachedTools round-trip', async () => {
    await setCachedTools(httpConfig, sampleTools, 3600);
    const result = await getCachedTools(httpConfig, 3600);
    expect(result).not.toBeNull();
    expect(result).toHaveLength(1);
    expect(result![0].name).toBe('search');
  });

  test('returns null when TTL has expired', async () => {
    await setCachedTools(stdioConfig, sampleTools, 3600);
    // Pass ttl=0 → any cached entry is considered expired
    const result = await getCachedTools(stdioConfig, 0);
    expect(result).toBeNull();
  });

  test('invalidateCache removes the entry', async () => {
    await setCachedTools(httpConfig, sampleTools, 3600);
    await invalidateCache(httpConfig);
    const result = await getCachedTools(httpConfig, 3600);
    expect(result).toBeNull();
  });

  test('different configs have separate caches', async () => {
    await setCachedTools(httpConfig, sampleTools, 3600);
    await invalidateCache(stdioConfig); // different key — should not affect http cache
    const result = await getCachedTools(httpConfig, 3600);
    expect(result).not.toBeNull();
  });

  test('same URL with different headers have separate caches', async () => {
    const config1: McpServerConfig = {
      type: 'http',
      url: 'https://example.com/mcp',
      headers: { Authorization: 'Bearer TOKEN1' },
    };
    const config2: McpServerConfig = {
      type: 'http',
      url: 'https://example.com/mcp',
      headers: { Authorization: 'Bearer TOKEN2' },
    };
    const tools1: ToolDefinition[] = [
      { name: 'tool-from-token1', inputSchema: { type: 'object' } },
    ];
    const tools2: ToolDefinition[] = [
      { name: 'tool-from-token2', inputSchema: { type: 'object' } },
    ];
    await setCachedTools(config1, tools1, 3600);
    await setCachedTools(config2, tools2, 3600);
    const result1 = await getCachedTools(config1, 3600);
    const result2 = await getCachedTools(config2, 3600);
    expect(result1![0].name).toBe('tool-from-token1');
    expect(result2![0].name).toBe('tool-from-token2');
  });

  test('same command with different env have separate caches', async () => {
    const config1: McpServerConfig = {
      type: 'stdio',
      command: 'node server.js',
      env: { API_KEY: 'key1' },
    };
    const config2: McpServerConfig = {
      type: 'stdio',
      command: 'node server.js',
      env: { API_KEY: 'key2' },
    };
    const tools1: ToolDefinition[] = [
      { name: 'tool-env1', inputSchema: { type: 'object' } },
    ];
    const tools2: ToolDefinition[] = [
      { name: 'tool-env2', inputSchema: { type: 'object' } },
    ];
    await setCachedTools(config1, tools1, 3600);
    await setCachedTools(config2, tools2, 3600);
    const result1 = await getCachedTools(config1, 3600);
    const result2 = await getCachedTools(config2, 3600);
    expect(result1![0].name).toBe('tool-env1');
    expect(result2![0].name).toBe('tool-env2');
  });

  test('returns null and warns on corrupted cache file', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    // Write valid cache first to create the file path, then corrupt it
    await setCachedTools(httpConfig, sampleTools, 3600);
    const cachePath = path.join(tmpDir, '.mcp2cli', 'cache');
    const files = await fs.readdir(cachePath);
    const cacheFile = files.find((f) => f.endsWith('.json'));
    expect(cacheFile).toBeDefined();
    await fs.writeFile(path.join(cachePath, cacheFile!), 'NOT VALID JSON');
    const result = await getCachedTools(httpConfig, 3600);
    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('could not read tool cache'));
    warnSpy.mockRestore();
  });

  test('cache stores full tool definition', async () => {
    const tools: ToolDefinition[] = [
      {
        name: 'complex-tool',
        description: 'A complex tool',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'A name' },
            count: { type: 'integer', default: 5 },
          },
          required: ['name'],
        },
      },
    ];
    const cfg: McpServerConfig = { type: 'http', url: 'https://complex.example.com/mcp' };
    await setCachedTools(cfg, tools, 3600);
    const result = await getCachedTools(cfg, 3600);
    expect(result![0].inputSchema.properties?.count?.default).toBe(5);
  });
});
