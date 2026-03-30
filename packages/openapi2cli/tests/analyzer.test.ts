import { analyzeSchema } from '../src/analyzer/schema-analyzer';
import { OpenAPIV3 } from 'openapi-types';

const minimalSpec: OpenAPIV3.Document = {
  openapi: '3.0.0',
  info: { title: 'Test API', version: '1.0.0' },
  paths: {
    '/users': {
      get: {
        operationId: 'listUsers',
        tags: ['users'],
        summary: 'List all users',
        parameters: [
          {
            name: 'limit',
            in: 'query',
            required: false,
            schema: { type: 'integer', default: 10 },
          },
          {
            name: 'status',
            in: 'query',
            required: false,
            schema: { type: 'string', enum: ['active', 'inactive'] },
          },
        ],
        responses: { '200': { description: 'OK' } },
      },
      post: {
        operationId: 'createUser',
        tags: ['users'],
        summary: 'Create a user',
        requestBody: {
          description: 'User data',
          required: true,
          content: { 'application/json': { schema: { type: 'object' } } },
        },
        responses: { '201': { description: 'Created' } },
      },
    },
    '/users/{userId}': {
      get: {
        operationId: 'getUser',
        tags: ['users'],
        summary: 'Get a user by ID',
        parameters: [
          {
            name: 'userId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': { description: 'OK' },
          '404': { description: 'Not Found' },
        },
      },
    },
  },
};

describe('analyzeSchema', () => {
  it('creates one group per tag', () => {
    const structure = analyzeSchema(minimalSpec, 'test-cli');
    expect(structure.groups).toHaveLength(1);
    expect(structure.groups[0].name).toBe('users');
  });

  it('maps operations to subcommands', () => {
    const structure = analyzeSchema(minimalSpec, 'test-cli');
    const usersGroup = structure.groups[0];
    expect(usersGroup.subcommands).toHaveLength(3);
    const names = usersGroup.subcommands.map((s) => s.name);
    expect(names).toContain('list-users');
    expect(names).toContain('create-user');
    expect(names).toContain('get-user');
  });

  it('maps integer query parameters to number options', () => {
    const structure = analyzeSchema(minimalSpec, 'test-cli');
    const listUsers = structure.groups[0].subcommands.find((s) => s.name === 'list-users')!;
    const limitOpt = listUsers.options.find((o) => o.name === 'limit');
    expect(limitOpt).toBeDefined();
    expect(limitOpt!.type).toBe('number');
    expect(limitOpt!.required).toBe(false);
    expect(limitOpt!.defaultValue).toBe(10);
  });

  it('maps enum parameters to options with enum field', () => {
    const structure = analyzeSchema(minimalSpec, 'test-cli');
    const listUsers = structure.groups[0].subcommands.find((s) => s.name === 'list-users')!;
    const statusOpt = listUsers.options.find((o) => o.name === 'status');
    expect(statusOpt).toBeDefined();
    expect(statusOpt!.enum).toEqual(['active', 'inactive']);
  });

  it('maps requestBody to a --data option', () => {
    const structure = analyzeSchema(minimalSpec, 'test-cli');
    const createUser = structure.groups[0].subcommands.find((s) => s.name === 'create-user')!;
    const dataOpt = createUser.options.find((o) => o.name === 'data');
    expect(dataOpt).toBeDefined();
    expect(dataOpt!.required).toBe(true);
    expect(dataOpt!.type).toBe('string');
  });

  it('sets correct HTTP method and path', () => {
    const structure = analyzeSchema(minimalSpec, 'test-cli');
    const getUser = structure.groups[0].subcommands.find((s) => s.name === 'get-user')!;
    expect(getUser.method).toBe('get');
    expect(getUser.path).toBe('/users/{userId}');
  });

  it('includes global options endpoint, format, verbose', () => {
    const structure = analyzeSchema(minimalSpec, 'test-cli');
    const names = structure.globalOptions.map((o) => o.name);
    expect(names).toContain('endpoint');
    expect(names).toContain('format');
    expect(names).toContain('verbose');
  });

  it('format global option is boolean=false and has enum', () => {
    const structure = analyzeSchema(minimalSpec, 'test-cli');
    const verbose = structure.globalOptions.find((o) => o.name === 'verbose')!;
    expect(verbose.type).toBe('boolean');
    const format = structure.globalOptions.find((o) => o.name === 'format')!;
    expect(format.enum).toEqual(['json', 'yaml', 'table']);
  });

  it('puts untagged operations into flatCommands (not a group)', () => {
    const spec: OpenAPIV3.Document = {
      ...minimalSpec,
      paths: {
        '/health': {
          get: {
            operationId: 'healthCheck',
            summary: 'Health check',
            responses: { '200': { description: 'OK' } },
          },
        },
      },
    };
    const structure = analyzeSchema(spec, 'test-cli');
    expect(structure.groups).toHaveLength(0);
    expect(structure.flatCommands).toHaveLength(1);
    expect(structure.flatCommands[0].name).toBe('health-check');
  });

  it('emits a warning for missing operationId', () => {
    const spec: OpenAPIV3.Document = {
      ...minimalSpec,
      paths: {
        '/health': {
          get: {
            summary: 'Health check',
            responses: { '200': { description: 'OK' } },
          },
        },
      },
    };
    const structure = analyzeSchema(spec, 'test-cli');
    expect(structure.warnings.some((w) => w.includes('缺少 operationId'))).toBe(true);
  });

  it('converts CJK tag names to pinyin and emits a warning', () => {
    const spec: OpenAPIV3.Document = {
      ...minimalSpec,
      tags: [{ name: '用户管理' }],
      paths: {
        '/users': {
          get: {
            operationId: 'listUsers',
            tags: ['用户管理'],
            summary: 'List users',
            responses: { '200': { description: 'OK' } },
          },
        },
      },
    };
    const structure = analyzeSchema(spec, 'test-cli');
    expect(structure.groups[0].name).toMatch(/^[a-z-]+$/); // all latin
    expect(structure.warnings.some((w) => w.includes('用户管理'))).toBe(true);
  });

  it('includes query and all-pages in global options', () => {
    const structure = analyzeSchema(minimalSpec, 'test-cli');
    const names = structure.globalOptions.map((o) => o.name);
    expect(names).toContain('query');
    expect(names).toContain('all-pages');
  });

  it('respects x-cli-ignore to skip an operation', () => {
    const spec: OpenAPIV3.Document = {
      ...minimalSpec,
      paths: {
        '/health': {
          get: {
            operationId: 'healthCheck',
            summary: 'Health check',
            'x-cli-ignore': true,
            responses: { '200': { description: 'OK' } },
          } as OpenAPIV3.OperationObject,
        },
      },
    };
    const structure = analyzeSchema(spec, 'test-cli');
    expect(structure.flatCommands).toHaveLength(0);
    expect(structure.groups).toHaveLength(0);
  });

  it('uses x-cli-name as command name', () => {
    const spec: OpenAPIV3.Document = {
      ...minimalSpec,
      paths: {
        '/users': {
          get: {
            operationId: 'listUsers',
            'x-cli-name': 'ls',
            tags: ['users'],
            summary: 'List users',
            responses: { '200': { description: 'OK' } },
          } as OpenAPIV3.OperationObject,
        },
      },
    };
    const structure = analyzeSchema(spec, 'test-cli');
    expect(structure.groups[0].subcommands[0].name).toBe('ls');
  });

  it('extracts x-cli-aliases into aliases array', () => {
    const spec: OpenAPIV3.Document = {
      ...minimalSpec,
      paths: {
        '/users': {
          get: {
            operationId: 'listUsers',
            'x-cli-aliases': ['ls', 'list'],
            tags: ['users'],
            summary: 'List users',
            responses: { '200': { description: 'OK' } },
          } as OpenAPIV3.OperationObject,
        },
      },
    };
    const structure = analyzeSchema(spec, 'test-cli');
    expect(structure.groups[0].subcommands[0].aliases).toEqual(['ls', 'list']);
  });

  it('generates per-field body options when requestBody has schema properties', () => {
    const spec: OpenAPIV3.Document = {
      ...minimalSpec,
      paths: {
        '/users': {
          post: {
            operationId: 'createUser',
            tags: ['users'],
            summary: 'Create a user',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['name'],
                    properties: {
                      name: { type: 'string', description: 'User name' },
                      age: { type: 'integer', description: 'User age' },
                    },
                  },
                },
              },
            },
            responses: { '201': { description: 'Created' } },
          },
        },
      },
    };
    const structure = analyzeSchema(spec, 'test-cli');
    const createUser = structure.groups[0].subcommands[0];
    const nameOpt = createUser.options.find((o) => o.name === 'name');
    const ageOpt = createUser.options.find((o) => o.name === 'age');
    const dataOpt = createUser.options.find((o) => o.name === 'data');
    expect(nameOpt).toBeDefined();
    expect(nameOpt!.required).toBe(true);
    expect(ageOpt).toBeDefined();
    expect(ageOpt!.type).toBe('number');
    // --data should be optional override
    expect(dataOpt).toBeDefined();
    expect(dataOpt!.required).toBe(false);
  });

  it('stores optKey on requestBody fields', () => {
    const spec: OpenAPIV3.Document = {
      ...minimalSpec,
      paths: {
        '/users': {
          post: {
            operationId: 'createUser',
            tags: ['users'],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: { firstName: { type: 'string' } },
                  },
                },
              },
            },
            responses: { '201': { description: 'Created' } },
          },
        },
      },
    };
    const structure = analyzeSchema(spec, 'test-cli');
    const rb = structure.groups[0].subcommands[0].requestBody!;
    expect(rb.fields[0].optKey).toBe('firstName');
  });

  it('extracts bearer auth config with CLI-prefixed env var', () => {
    const spec: OpenAPIV3.Document = {
      ...minimalSpec,
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer' },
        },
      },
    };
    const structure = analyzeSchema(spec, 'test-cli');
    expect(structure.authConfig.type).toBe('bearer');
    // env var is prefixed with SCREAMING_SNAKE_CASE(cliName)
    expect(structure.authConfig.envVar).toBe('TEST_CLI_TOKEN');
    expect(structure.allAuthSchemes).toContain('bearerAuth');
  });

  it('prefixes apiKey env var with CLI name', () => {
    const spec: OpenAPIV3.Document = {
      ...minimalSpec,
      components: {
        securitySchemes: {
          apiKeyAuth: { type: 'apiKey', name: 'X-API-Key', in: 'header' },
        },
      },
    };
    const structure = analyzeSchema(spec, 'my-service');
    expect(structure.authConfig.type).toBe('apiKey');
    expect(structure.authConfig.envVar).toBe('MY_SERVICE_API_KEY');
    expect(structure.authConfig.headerName).toBe('X-API-Key');
  });

  it('extracts oauth2 clientCredentials as oauth2-cc with correct env vars', () => {
    const spec: OpenAPIV3.Document = {
      ...minimalSpec,
      components: {
        securitySchemes: {
          oauth2: {
            type: 'oauth2',
            flows: {
              clientCredentials: {
                tokenUrl: 'https://auth.example.com/token',
                scopes: { read: 'Read access' },
              },
            },
          },
        },
      },
    };
    const structure = analyzeSchema(spec, 'petstore');
    expect(structure.authConfig.type).toBe('oauth2-cc');
    expect(structure.authConfig.tokenUrl).toBe('https://auth.example.com/token');
    expect(structure.authConfig.clientIdEnvVar).toBe('PETSTORE_CLIENT_ID');
    expect(structure.authConfig.clientSecretEnvVar).toBe('PETSTORE_CLIENT_SECRET');
    expect(structure.authConfig.scopesEnvVar).toBe('PETSTORE_SCOPES');
  });

  it('extracts x-cli-token-url extension as dynamic auth', () => {
    const spec: OpenAPIV3.Document = {
      ...minimalSpec,
      components: {
        securitySchemes: {
          userAuth: {
            type: 'http',
            scheme: 'bearer',
            'x-cli-token-url': 'https://auth.example.com/get-token',
            'x-cli-token-env-vars': [
              { name: 'userId', env: 'MY_CLI_USER_ID' },
            ],
          } as OpenAPIV3.SecuritySchemeObject,
        },
      },
    };
    const structure = analyzeSchema(spec, 'my-cli');
    expect(structure.authConfig.type).toBe('dynamic');
    expect(structure.authConfig.tokenUrl).toBe('https://auth.example.com/get-token');
    expect(structure.authConfig.tokenEnvVars).toEqual([
      { name: 'userId', env: 'MY_CLI_USER_ID' },
    ]);
  });

  it('detects SSE streaming from text/event-stream response', () => {
    const spec: OpenAPIV3.Document = {
      ...minimalSpec,
      paths: {
        '/events': {
          get: {
            operationId: 'streamEvents',
            tags: ['events'],
            summary: 'Stream events',
            responses: {
              '200': {
                description: 'Event stream',
                content: { 'text/event-stream': { schema: { type: 'string' } } },
              },
            },
          },
        },
      },
    };
    const structure = analyzeSchema(spec, 'test-cli');
    const cmd = structure.groups[0].subcommands[0];
    expect(cmd.streaming).toBe('sse');
  });

  it('does not set streaming for regular JSON responses', () => {
    const structure = analyzeSchema(minimalSpec, 'test-cli');
    const listUsers = structure.groups[0].subcommands.find((s) => s.name === 'list-users')!;
    expect(listUsers.streaming).toBeUndefined();
  });

  it('sets baseUrl from first server', () => {
    const spec: OpenAPIV3.Document = {
      ...minimalSpec,
      servers: [{ url: 'https://api.example.com/v2' }],
    };
    const structure = analyzeSchema(spec, 'test-cli');
    expect(structure.baseUrl).toBe('https://api.example.com/v2');
  });

  it('defaults baseUrl to http://localhost when no servers defined', () => {
    const structure = analyzeSchema(minimalSpec, 'test-cli');
    expect(structure.baseUrl).toBe('http://localhost');
  });

  it('detects and renames duplicate command names within a group', () => {
    const spec: OpenAPIV3.Document = {
      ...minimalSpec,
      paths: {
        '/items': {
          get: {
            operationId: 'listItems',
            tags: ['items'],
            summary: 'List items',
            responses: { '200': { description: 'OK' } },
          },
          post: {
            operationId: 'listItems',
            tags: ['items'],
            summary: 'Create items (duplicate name)',
            responses: { '201': { description: 'Created' } },
          },
        },
      },
    };
    const structure = analyzeSchema(spec, 'test-cli');
    const names = structure.groups[0].subcommands.map((s) => s.name);
    // First keeps original name, second gets method appended
    expect(names).toContain('list-items');
    expect(names).toContain('list-items-post');
    expect(structure.warnings.some((w) => w.includes('Duplicate command name'))).toBe(true);
  });

  it('detects and renames duplicate command names among flat commands', () => {
    const spec: OpenAPIV3.Document = {
      ...minimalSpec,
      paths: {
        '/health': {
          get: {
            operationId: 'check',
            summary: 'Health check',
            responses: { '200': { description: 'OK' } },
          },
        },
        '/status': {
          get: {
            operationId: 'check',
            summary: 'Status check (duplicate name)',
            responses: { '200': { description: 'OK' } },
          },
        },
      },
    };
    const structure = analyzeSchema(spec, 'test-cli');
    const names = structure.flatCommands.map((s) => s.name);
    expect(names).toContain('check');
    expect(names).toContain('check-get');
    expect(structure.warnings.some((w) => w.includes('Duplicate command name'))).toBe(true);
  });
});
