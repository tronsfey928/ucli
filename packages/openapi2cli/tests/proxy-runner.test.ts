/**
 * Unit tests for src/runner/proxy-runner.ts
 *
 * Mocks parseOAS / analyzeSchema / createRuntimeClient so no network or file
 * system access is needed.
 */
import * as fse from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { proxyRun, ProxyOpts } from '../src/runner/proxy-runner';
import * as oasParser from '../src/parser/oas-parser';
import * as cacheModule from '../src/cache';
import * as schemaAnalyzer from '../src/analyzer/schema-analyzer';
import * as httpClientModule from '../src/runner/http-client';
import { CommandStructure } from '../src/types/index';
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
          description: 'Get an item',
          method: 'get',
          path: '/items/{id}',
          parameters: [{ name: 'id', in: 'path', description: 'Item ID', required: true, schema: { type: 'string' } }],
          options: [{ name: 'id', description: 'Item ID', required: true, type: 'string' }],
          responses: {},
          securitySchemes: [],
          aliases: [],
        },
        {
          name: 'list-items',
          description: 'List items',
          method: 'get',
          path: '/items',
          parameters: [{ name: 'status', in: 'query', description: 'Filter', required: false, schema: { type: 'string', enum: ['active', 'inactive'] } }],
          options: [{ name: 'status', description: 'Filter', required: false, type: 'string', enum: ['active', 'inactive'] }],
          responses: {},
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
            ],
          },
          options: [
            { name: 'name', description: 'Item name', required: true, type: 'string' },
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
      description: 'Ping',
      method: 'get',
      path: '/ping',
      parameters: [],
      options: [],
      responses: {},
      securitySchemes: [],
      aliases: [],
    },
    {
      name: 'create-record',
      description: 'Create a record with typed fields',
      method: 'post',
      path: '/records',
      parameters: [
        { name: 'X-Request-Id', in: 'header', description: 'Request ID', required: false, schema: { type: 'string' } },
        { name: 'session', in: 'cookie', description: 'Session cookie', required: false, schema: { type: 'string' } },
      ],
      requestBody: {
        description: 'Record body',
        required: true,
        contentType: 'application/json',
        schema: {},
        fields: [
          { name: 'count', optKey: 'count', type: 'integer', required: true, description: 'Record count' },
          { name: 'score', optKey: 'score', type: 'number', required: false, description: 'Score value' },
          { name: 'active', optKey: 'active', type: 'boolean', required: false, description: 'Active flag' },
          { name: 'label', optKey: 'label', type: 'string', required: false, description: 'Label' },
        ],
      },
      options: [
        { name: 'x-request-id', description: 'Request ID', required: false, type: 'string' },
        { name: 'session', description: 'Session cookie', required: false, type: 'string' },
        { name: 'count', description: 'Record count', required: true, type: 'number' },
        { name: 'score', description: 'Score value', required: false, type: 'number' },
        { name: 'active', description: 'Active flag', required: false, type: 'boolean' },
        { name: 'label', description: 'Label', required: false, type: 'string' },
        { name: 'data', description: 'Raw JSON body', required: false, type: 'string' },
      ],
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
let exitCode: number | null = null;
let consoleErrors: string[] = [];

beforeEach(() => {
  exitCode = null;
  consoleErrors = [];

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

  jest.spyOn(process, 'exit').mockImplementation((code?: number | string | null) => {
    exitCode = Number(code ?? 0);
    throw new Error(`process.exit(${code})`);
  });

  jest.spyOn(console, 'error').mockImplementation((...args) => {
    consoleErrors.push(args.map(String).join(' '));
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ─── Shared proxy opts ────────────────────────────────────────────────────────

const BASE_OPTS: ProxyOpts = { oas: 'fake.yaml' };

// ─── listOperations (no remaining args) ───────────────────────────────────────

describe('proxyRun — no operation (list mode)', () => {
  it('prints group names to stdout', async () => {
    const lines: string[] = [];
    jest.spyOn(console, 'log').mockImplementation((...args) => lines.push(args.join(' ')));

    await proxyRun(BASE_OPTS, []);

    const all = lines.join('\n');
    expect(all).toContain('items');
    expect(all).toContain('get-item');
    expect(all).toContain('ping');
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it('shows "(no operations)" when structure is empty', async () => {
    jest.spyOn(schemaAnalyzer, 'analyzeSchema').mockReturnValue({
      ...MOCK_STRUCTURE,
      groups: [],
      flatCommands: [],
    });
    const lines: string[] = [];
    jest.spyOn(console, 'log').mockImplementation((...args) => lines.push(args.join(' ')));

    await proxyRun(BASE_OPTS, []);
    expect(lines.join('\n')).toContain('no operations');
  });
});

// ─── executeOperation — path params ───────────────────────────────────────────

describe('proxyRun — path parameters', () => {
  it('sends the path param to the HTTP client', async () => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    await proxyRun(BASE_OPTS, ['items', 'get-item', '--id', '42']);
    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({ pathParams: { id: '42' }, path: '/items/{id}' })
    );
  });
});

// ─── executeOperation — query params ──────────────────────────────────────────

describe('proxyRun — query parameters', () => {
  it('sends query params to the HTTP client', async () => {
    mockRequest.mockResolvedValue([{ id: '1', status: 'active' }]);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    await proxyRun(BASE_OPTS, ['items', 'list-items', '--status', 'active']);
    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({ queryParams: { status: 'active' } })
    );
  });
});

// ─── executeOperation — body fields ───────────────────────────────────────────

describe('proxyRun — request body fields', () => {
  it('assembles body from individual field options', async () => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    await proxyRun(BASE_OPTS, ['items', 'create-item', '--name', 'Widget']);
    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({ body: { name: 'Widget' }, method: 'post' })
    );
  });
});

// ─── --data override ──────────────────────────────────────────────────────────

describe('proxyRun — --data raw JSON override', () => {
  it('uses raw JSON body and ignores field options', async () => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    await proxyRun(BASE_OPTS, ['items', 'create-item', '--data', '{"name":"Raw","extra":true}']);
    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({ body: { name: 'Raw', extra: true } })
    );
  });

  it('reads body from @file', async () => {
    const tmp = path.join(os.tmpdir(), `proxy-test-${Date.now()}.json`);
    await fse.writeFile(tmp, JSON.stringify({ name: 'FromFile' }));
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    await proxyRun(BASE_OPTS, ['items', 'create-item', '--data', `@${tmp}`]);
    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({ body: { name: 'FromFile' } })
    );
    await fse.remove(tmp);
  });
});

// ─── Auth forwarded to createRuntimeClient ────────────────────────────────────

describe('proxyRun — auth options forwarded', () => {
  it('passes bearer to createRuntimeClient', async () => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    await proxyRun({ oas: 'fake.yaml', bearer: 'tok123' }, ['items', 'list-items']);
    expect(httpClientModule.createRuntimeClient).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ bearer: 'tok123' }),
      expect.any(Object)
    );
  });

  it('parses --header strings into extraHeaders', async () => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    await proxyRun({ oas: 'fake.yaml', header: ['X-Foo: bar', 'X-Baz: qux'] }, ['items', 'list-items']);
    expect(httpClientModule.createRuntimeClient).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ extraHeaders: { 'X-Foo': 'bar', 'X-Baz': 'qux' } }),
      expect.any(Object)
    );
  });

  it('uses --endpoint to override the base URL', async () => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    await proxyRun({ oas: 'fake.yaml', endpoint: 'http://custom-host:9000' }, ['items', 'list-items']);
    expect(httpClientModule.createRuntimeClient).toHaveBeenCalledWith(
      'http://custom-host:9000',
      expect.any(Object),
      expect.any(Object)
    );
  });
});

// ─── Unknown command ──────────────────────────────────────────────────────────

describe('proxyRun — unknown command', () => {
  it('throws InputValidationError for an unknown command', async () => {
    await expect(proxyRun(BASE_OPTS, ['no-such-group'])).rejects.toThrow(
      /Unknown command/
    );
  });
});

// ─── OAS load failure ─────────────────────────────────────────────────────────

describe('proxyRun — OAS load failure', () => {
  it('throws SpecParseError if parseOASWithCache throws', async () => {
    jest.spyOn(cacheModule, 'parseOASWithCache').mockRejectedValue(new Error('File not found'));
    await expect(proxyRun(BASE_OPTS, [])).rejects.toThrow(
      /Failed to load spec.*File not found/
    );
  });
});

// ─── Body field type coercion ─────────────────────────────────────────────────

describe('proxyRun — body field type coercion', () => {
  it('coerces integer field from string to number', async () => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    await proxyRun(BASE_OPTS, ['create-record', '--count', '42']);
    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({ body: { count: 42 } })
    );
  });

  it('coerces number (float) field from string to number', async () => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    await proxyRun(BASE_OPTS, ['create-record', '--count', '5', '--score', '3.14']);
    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({ body: { count: 5, score: 3.14 } })
    );
  });

  it('leaves string fields as strings', async () => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    await proxyRun(BASE_OPTS, ['create-record', '--count', '1', '--label', 'hello']);
    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({ body: { count: 1, label: 'hello' } })
    );
  });
});

// ─── Header and cookie parameter forwarding ───────────────────────────────────

describe('proxyRun — header/cookie parameter forwarding', () => {
  it('sends header parameters in the request headers', async () => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    await proxyRun(BASE_OPTS, ['create-record', '--count', '1', '--x-request-id', 'req-123']);
    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({ 'X-Request-Id': 'req-123' }),
      })
    );
  });

  it('sends cookie parameters as Cookie header', async () => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    await proxyRun(BASE_OPTS, ['create-record', '--count', '1', '--session', 'abc123']);
    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({ Cookie: 'session=abc123' }),
      })
    );
  });
});
