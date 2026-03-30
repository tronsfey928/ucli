/**
 * Unit tests for agent-friendly features: --machine, --dry-run, describe.
 *
 * Uses the same mock setup as proxy-runner.test.ts but tests the structured
 * JSON envelope output, operation introspection, and dry-run preview.
 */
import * as fse from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { proxyRun, ProxyOpts } from '../src/runner/proxy-runner';
import * as oasParser from '../src/parser/oas-parser';
import * as cacheModule from '../src/cache';
import * as schemaAnalyzer from '../src/analyzer/schema-analyzer';
import * as httpClientModule from '../src/runner/http-client';
import { CommandStructure, AgentEnvelope } from '../src/types/index';
import { OpenAPIV3 } from 'openapi-types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const MOCK_API = {} as OpenAPIV3.Document;

const MOCK_STRUCTURE: CommandStructure = {
  name: '_proxy_',
  description: 'Test API',
  version: '1.0.0',
  baseUrl: 'http://localhost:3000',
  groups: [
    {
      name: 'items',
      description: 'Manage items',
      subcommands: [
        {
          name: 'get-item',
          description: 'Get an item by ID',
          method: 'get',
          path: '/items/{id}',
          parameters: [{ name: 'id', in: 'path', description: 'Item ID', required: true, schema: { type: 'string' } }],
          options: [{ name: 'id', description: 'Item ID', required: true, type: 'string' }],
          responses: {
            '200': {
              statusCode: '200',
              description: 'OK',
              contentType: 'application/json',
              fields: [
                { name: 'id', type: 'string', description: 'Item ID' },
                { name: 'name', type: 'string', description: 'Item name' },
              ],
              isArray: false,
            },
          },
          securitySchemes: ['bearerAuth'],
          aliases: [],
        },
        {
          name: 'list-items',
          description: 'List items',
          method: 'get',
          path: '/items',
          parameters: [{ name: 'status', in: 'query', description: 'Filter by status', required: false, schema: { type: 'string', enum: ['active', 'inactive'] } }],
          options: [{ name: 'status', description: 'Filter by status', required: false, type: 'string', enum: ['active', 'inactive'] }],
          responses: {
            '200': {
              statusCode: '200',
              description: 'OK',
              contentType: 'application/json',
              fields: [{ name: 'id', type: 'string', description: 'Item ID' }],
              isArray: true,
            },
          },
          securitySchemes: [],
          aliases: [],
        },
        {
          name: 'create-item',
          description: 'Create an item',
          method: 'post',
          path: '/items',
          parameters: [],
          requestBody: {
            description: 'Item body',
            required: true,
            contentType: 'application/json',
            schema: {},
            fields: [
              { name: 'name', optKey: 'name', type: 'string', required: true, description: 'Item name' },
              { name: 'price', optKey: 'price', type: 'number', required: false, description: 'Item price' },
            ],
          },
          options: [
            { name: 'name', description: 'Item name', required: true, type: 'string' },
            { name: 'price', description: 'Item price', required: false, type: 'number' },
            { name: 'data', description: 'Raw JSON body', required: false, type: 'string' },
          ],
          responses: {},
          securitySchemes: [],
          aliases: [],
        },
      ],
    },
  ],
  flatCommands: [
    {
      name: 'ping',
      description: 'Health check',
      method: 'get',
      path: '/ping',
      parameters: [],
      options: [],
      responses: {},
      securitySchemes: [],
      aliases: [],
    },
  ],
  globalOptions: [],
  authConfig: { type: 'none', envVar: '' },
  allAuthSchemes: [],
  warnings: [],
};

// ─── Mock setup ───────────────────────────────────────────────────────────────

let mockRequest: jest.Mock;
let mockRequestStream: jest.Mock;
let consoleOutput: string[] = [];

beforeEach(() => {
  consoleOutput = [];

  jest.spyOn(oasParser, 'parseOAS').mockResolvedValue(MOCK_API);
  jest.spyOn(cacheModule, 'parseOASWithCache').mockResolvedValue(MOCK_API);
  jest.spyOn(schemaAnalyzer, 'analyzeSchema').mockReturnValue(MOCK_STRUCTURE);

  mockRequest = jest.fn().mockResolvedValue({ id: '1', name: 'Alpha' });
  mockRequestStream = jest.fn().mockImplementation(async function* () {
    yield 'event-data';
  });

  jest.spyOn(httpClientModule, 'createRuntimeClient').mockReturnValue({
    request: mockRequest,
    requestStream: mockRequestStream,
  });

  jest.spyOn(console, 'log').mockImplementation((...args) => {
    consoleOutput.push(args.join(' '));
  });
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

const BASE_OPTS: ProxyOpts = { oas: 'fake.yaml' };
const MACHINE_OPTS: ProxyOpts = { oas: 'fake.yaml', machine: true };

// Helper to parse the last JSON output
function getEnvelope(): AgentEnvelope {
  const jsonStr = consoleOutput[consoleOutput.length - 1];
  return JSON.parse(jsonStr);
}

// ─── Machine mode: list operations ───────────────────────────────────────────

describe('proxyRun --machine — list operations', () => {
  it('outputs a structured JSON envelope with all operations', async () => {
    await proxyRun(MACHINE_OPTS, []);

    const env = getEnvelope();
    expect(env.success).toBe(true);
    expect(env.data).toBeDefined();
    const data = env.data as Record<string, unknown>;
    expect(data.totalOperations).toBe(4);
    expect(data.baseUrl).toBe('http://localhost:3000');
    expect(data.groups).toBeDefined();
    expect(Array.isArray(data.operations)).toBe(true);
  });

  it('includes group info in each operation', async () => {
    await proxyRun(MACHINE_OPTS, []);

    const env = getEnvelope();
    const ops = (env.data as Record<string, unknown>).operations as Array<Record<string, unknown>>;
    const getItem = ops.find(o => o.name === 'get-item');
    expect(getItem).toBeDefined();
    expect(getItem!.group).toBe('items');
    expect(getItem!.method).toBe('GET');
    expect(getItem!.path).toBe('/items/{id}');
  });

  it('includes flat commands without group', async () => {
    await proxyRun(MACHINE_OPTS, []);

    const env = getEnvelope();
    const ops = (env.data as Record<string, unknown>).operations as Array<Record<string, unknown>>;
    const ping = ops.find(o => o.name === 'ping');
    expect(ping).toBeDefined();
    expect(ping!.group).toBeUndefined();
  });

  it('outputs empty operations list for empty spec', async () => {
    jest.spyOn(schemaAnalyzer, 'analyzeSchema').mockReturnValue({
      ...MOCK_STRUCTURE,
      groups: [],
      flatCommands: [],
    });

    await proxyRun(MACHINE_OPTS, []);

    const env = getEnvelope();
    expect(env.success).toBe(true);
    const data = env.data as Record<string, unknown>;
    expect(data.totalOperations).toBe(0);
  });
});

// ─── Machine mode: describe ──────────────────────────────────────────────────

describe('proxyRun --machine — describe', () => {
  it('returns full operation detail for a grouped operation', async () => {
    await proxyRun(MACHINE_OPTS, ['describe', 'items', 'get-item']);

    const env = getEnvelope();
    expect(env.success).toBe(true);
    const detail = env.data as Record<string, unknown>;
    expect(detail.name).toBe('get-item');
    expect(detail.group).toBe('items');
    expect(detail.method).toBe('GET');
    expect(detail.path).toBe('/items/{id}');
    expect(detail.parameters).toBeDefined();
    expect((detail.parameters as unknown[]).length).toBe(1);
    expect(detail.authentication).toEqual(['bearerAuth']);
    expect(detail.exampleCommand).toContain('--id');
  });

  it('returns operation detail for a flat command', async () => {
    await proxyRun(MACHINE_OPTS, ['describe', 'ping']);

    const env = getEnvelope();
    expect(env.success).toBe(true);
    const detail = env.data as Record<string, unknown>;
    expect(detail.name).toBe('ping');
    expect(detail.group).toBeUndefined();
  });

  it('includes request body fields in describe output', async () => {
    await proxyRun(MACHINE_OPTS, ['describe', 'items', 'create-item']);

    const env = getEnvelope();
    expect(env.success).toBe(true);
    const detail = env.data as Record<string, unknown>;
    expect(detail.requestBody).toBeDefined();
    const rb = detail.requestBody as Record<string, unknown>;
    expect(rb.contentType).toBe('application/json');
    expect((rb.fields as unknown[]).length).toBe(2);
  });

  it('includes response schema in describe output', async () => {
    await proxyRun(MACHINE_OPTS, ['describe', 'items', 'get-item']);

    const env = getEnvelope();
    const detail = env.data as Record<string, unknown>;
    const responses = detail.responses as Array<Record<string, unknown>>;
    expect(responses.length).toBe(1);
    expect(responses[0].statusCode).toBe('200');
    expect((responses[0].fields as unknown[]).length).toBe(2);
  });

  it('includes options with flags and types in describe output', async () => {
    await proxyRun(MACHINE_OPTS, ['describe', 'items', 'list-items']);

    const env = getEnvelope();
    const detail = env.data as Record<string, unknown>;
    const options = detail.options as Array<Record<string, unknown>>;
    const statusOpt = options.find(o => o.flag === '--status');
    expect(statusOpt).toBeDefined();
    expect(statusOpt!.enum).toEqual(['active', 'inactive']);
  });

  it('returns error for unknown operation', async () => {
    await proxyRun(MACHINE_OPTS, ['describe', 'no-such']);

    const env = getEnvelope();
    expect(env.success).toBe(false);
    expect(env.error!.type).toBe('InputValidationError');
    expect(env.error!.message).toContain('not found');
  });

  it('returns error with no arguments', async () => {
    await proxyRun(MACHINE_OPTS, ['describe']);

    const env = getEnvelope();
    expect(env.success).toBe(false);
    expect(env.error!.message).toContain('Usage');
  });

  it('works in non-machine mode (human-readable)', async () => {
    await proxyRun(BASE_OPTS, ['describe', 'items', 'get-item']);

    const all = consoleOutput.join('\n');
    expect(all).toContain('get-item');
    expect(all).toContain('/items/{id}');
  });

  it('finds operation by name when only operation name is given', async () => {
    await proxyRun(MACHINE_OPTS, ['describe', 'get-item']);

    const env = getEnvelope();
    expect(env.success).toBe(true);
    const detail = env.data as Record<string, unknown>;
    expect(detail.name).toBe('get-item');
    expect(detail.group).toBe('items');
  });
});

// ─── Dry-run mode ─────────────────────────────────────────────────────────────

describe('proxyRun --dry-run', () => {
  it('emits a dry-run envelope with the planned request', async () => {
    await proxyRun({ oas: 'fake.yaml', dryRun: true }, ['items', 'get-item', '--id', '42']);

    const env = getEnvelope();
    expect(env.success).toBe(true);
    const data = env.data as Record<string, unknown>;
    expect(data.method).toBe('GET');
    expect(data.url).toBe('http://localhost:3000/items/42');
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it('includes query params in dry-run output', async () => {
    await proxyRun({ oas: 'fake.yaml', dryRun: true }, ['items', 'list-items', '--status', 'active']);

    const env = getEnvelope();
    expect(env.success).toBe(true);
    const data = env.data as Record<string, unknown>;
    expect(data.queryParams).toEqual({ status: 'active' });
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it('includes body in dry-run output for POST', async () => {
    await proxyRun({ oas: 'fake.yaml', dryRun: true }, ['items', 'create-item', '--name', 'Widget']);

    const env = getEnvelope();
    expect(env.success).toBe(true);
    const data = env.data as Record<string, unknown>;
    expect(data.method).toBe('POST');
    expect(data.body).toEqual({ name: 'Widget' });
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it('dry-run implies machine mode for list', async () => {
    await proxyRun({ oas: 'fake.yaml', dryRun: true }, []);

    const env = getEnvelope();
    expect(env.success).toBe(true);
    const data = env.data as Record<string, unknown>;
    expect(data.totalOperations).toBeDefined();
  });

  it('includes meta information in dry-run output', async () => {
    await proxyRun({ oas: 'fake.yaml', dryRun: true }, ['items', 'get-item', '--id', '42']);

    const env = getEnvelope();
    expect(env.meta).toBeDefined();
    expect(env.meta!.operation).toBe('get-item');
    expect(env.meta!.method).toBe('GET');
    expect(env.meta!.path).toBe('/items/{id}');
  });
});

// ─── Machine mode: execution ──────────────────────────────────────────────────

describe('proxyRun --machine — execution', () => {
  it('wraps successful response in envelope with meta', async () => {
    await proxyRun(MACHINE_OPTS, ['items', 'get-item', '--id', '42']);

    const env = getEnvelope();
    expect(env.success).toBe(true);
    expect(env.data).toEqual({ id: '1', name: 'Alpha' });
    expect(env.meta).toBeDefined();
    expect(env.meta!.operation).toBe('get-item');
    expect(env.meta!.durationMs).toBeDefined();
    expect(typeof env.meta!.durationMs).toBe('number');
  });

  it('wraps SSE events in envelope in machine mode', async () => {
    const sseStructure: CommandStructure = {
      ...MOCK_STRUCTURE,
      groups: [],
      flatCommands: [{
        name: 'stream',
        description: 'Stream events',
        method: 'get',
        path: '/events',
        parameters: [],
        options: [],
        responses: {},
        securitySchemes: [],
        aliases: [],
        streaming: 'sse',
      }],
    };
    jest.spyOn(schemaAnalyzer, 'analyzeSchema').mockReturnValue(sseStructure);

    await proxyRun(MACHINE_OPTS, ['stream']);

    const env = getEnvelope();
    expect(env.success).toBe(true);
    expect(env.data).toEqual(['event-data']);
  });
});

// ─── Machine mode: structured errors ──────────────────────────────────────────

describe('proxyRun --machine — structured errors', () => {
  it('outputs structured error for unknown command', async () => {
    await proxyRun(MACHINE_OPTS, ['no-such-group']);

    const env = getEnvelope();
    expect(env.success).toBe(false);
    expect(env.error!.type).toBe('InputValidationError');
    expect(env.error!.message).toContain('Unknown command');
    expect(env.error!.hint).toBeDefined();
  });

  it('outputs structured error for spec load failure', async () => {
    jest.spyOn(cacheModule, 'parseOASWithCache').mockRejectedValue(new Error('File not found'));

    await proxyRun(MACHINE_OPTS, []);

    const env = getEnvelope();
    expect(env.success).toBe(false);
    expect(env.error!.type).toBe('SpecParseError');
    expect(env.error!.message).toContain('File not found');
  });

  it('outputs structured error for HTTP error in machine mode', async () => {
    mockRequest.mockRejectedValue({
      response: { status: 404, statusText: 'Not Found', data: { error: 'resource not found' } },
      message: 'Not Found',
    });

    await proxyRun(MACHINE_OPTS, ['items', 'get-item', '--id', '999']);

    const env = getEnvelope();
    expect(env.success).toBe(false);
    expect(env.error!.type).toBe('HttpClientError');
    expect(env.error!.statusCode).toBe(404);
    expect(env.error!.responseData).toEqual({ error: 'resource not found' });
  });
});

// ─── `help` as alias for `describe` ──────────────────────────────────────────

describe('proxyRun — help alias', () => {
  it('help works like describe in machine mode', async () => {
    await proxyRun(MACHINE_OPTS, ['help', 'items', 'get-item']);

    const env = getEnvelope();
    expect(env.success).toBe(true);
    const detail = env.data as Record<string, unknown>;
    expect(detail.name).toBe('get-item');
    expect(detail.group).toBe('items');
    expect(detail.method).toBe('GET');
    expect(detail.parameters).toBeDefined();
  });

  it('help works for flat commands', async () => {
    await proxyRun(MACHINE_OPTS, ['help', 'ping']);

    const env = getEnvelope();
    expect(env.success).toBe(true);
    const detail = env.data as Record<string, unknown>;
    expect(detail.name).toBe('ping');
  });

  it('help with no args returns usage error', async () => {
    await proxyRun(MACHINE_OPTS, ['help']);

    const env = getEnvelope();
    expect(env.success).toBe(false);
    expect(env.error!.message).toContain('Usage');
  });

  it('help works in non-machine mode (human-readable)', async () => {
    await proxyRun(BASE_OPTS, ['help', 'items', 'get-item']);

    const all = consoleOutput.join('\n');
    expect(all).toContain('get-item');
    expect(all).toContain('/items/{id}');
  });
});

// ─── --debug mode ─────────────────────────────────────────────────────────────

describe('proxyRun --debug', () => {
  let stderrOutput: string[];

  beforeEach(() => {
    stderrOutput = [];
    // Override the console.error mock to capture stderr
    jest.spyOn(console, 'error').mockImplementation((...args) => {
      stderrOutput.push(args.map(String).join(' '));
    });
  });

  it('emits debug output to stderr when --debug is set', async () => {
    await proxyRun({ oas: 'fake.yaml', debug: true }, []);

    const all = stderrOutput.join('\n');
    expect(all).toContain('[debug]');
    expect(all).toContain('loading spec');
    expect(all).toContain('spec loaded successfully');
  });

  it('emits debug info about routing', async () => {
    await proxyRun({ oas: 'fake.yaml', debug: true }, ['items', 'get-item', '--id', '42']);

    const all = stderrOutput.join('\n');
    expect(all).toContain('[debug]');
    expect(all).toContain('routing to operation');
  });

  it('emits debug info on spec load failure', async () => {
    jest.spyOn(cacheModule, 'parseOASWithCache').mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(proxyRun({ oas: 'fake.yaml', debug: true }, [])).rejects.toThrow();

    const all = stderrOutput.join('\n');
    expect(all).toContain('[debug]');
    expect(all).toContain('spec load failed');
  });

  it('does not emit debug output when --debug is not set', async () => {
    await proxyRun(BASE_OPTS, []);

    const all = stderrOutput.join('\n');
    expect(all).not.toContain('[debug]');
  });

  it('emits debug with machine mode on spec failure', async () => {
    jest.spyOn(cacheModule, 'parseOASWithCache').mockRejectedValue(new Error('ECONNREFUSED'));

    await proxyRun({ oas: 'fake.yaml', machine: true, debug: true }, []);

    const all = stderrOutput.join('\n');
    expect(all).toContain('[debug]');
    expect(all).toContain('spec load failed');

    const env = getEnvelope();
    expect(env.success).toBe(false);
    expect(env.error!.type).toBe('SpecParseError');
  });
});
