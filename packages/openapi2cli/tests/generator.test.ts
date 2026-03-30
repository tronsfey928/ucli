import { generateProject } from '../src/generator/command-generator';
import { CommandStructure } from '../src/types/index';

const sampleStructure: CommandStructure = {
  name: 'my-api-cli',
  description: 'My API CLI',
  version: '1.0.0',
  baseUrl: 'https://api.example.com',
  groups: [
    {
      name: 'users',
      description: 'User management',
      subcommands: [
        {
          name: 'list-users',
          description: 'List all users',
          method: 'get',
          path: '/users',
          parameters: [],
          responses: { '200': { statusCode: '200', description: 'OK', fields: [], isArray: false } },
          options: [
            {
              name: 'limit',
              description: '[query] Page size',
              required: false,
              type: 'number',
              defaultValue: 10,
            },
            {
              name: 'status',
              description: '[query] Filter by status',
              required: false,
              type: 'string',
              enum: ['active', 'inactive'],
            },
            {
              name: 'verbose-mode',
              description: 'Verbose flag',
              required: false,
              type: 'boolean',
            },
          ],
          securitySchemes: [],
          aliases: [],
        },
        {
          name: 'create-user',
          description: 'Create a user',
          method: 'post',
          path: '/users',
          parameters: [],
          requestBody: {
            description: 'User data',
            required: true,
            contentType: 'application/json',
            schema: {},
            fields: [],
          },
          responses: { '201': { statusCode: '201', description: 'Created', fields: [], isArray: false } },
          options: [
            {
              name: 'data',
              description: 'User data (JSON string or @filename)',
              required: true,
              type: 'string',
            },
          ],
          securitySchemes: [],
          aliases: [],
        },
      ],
    },
  ],
  flatCommands: [],
  warnings: [],
  globalOptions: [
    { name: 'endpoint', description: 'Override base URL', required: false, type: 'string' },
    {
      name: 'format',
      description: 'Output format',
      required: false,
      type: 'string',
      defaultValue: 'json',
      enum: ['json', 'yaml', 'table'],
    },
    { name: 'verbose', description: 'Verbose', required: false, type: 'boolean' },
  ],
  authConfig: { type: 'bearer', envVar: 'API_TOKEN' },
  allAuthSchemes: ['bearerAuth'],
};

describe('generateProject', () => {
  it('generates the expected set of files', async () => {
    const files = await generateProject(sampleStructure);
    const paths = files.map((f) => f.relativePath);

    expect(paths).toContain('package.json');
    expect(paths).toContain('tsconfig.json');
    expect(paths).toContain('src/index.ts');
    expect(paths).toContain('src/commands/users.ts');
    expect(paths).toContain('src/lib/api-client.ts');
    expect(paths).toContain('README.md');
    expect(paths.some((p) => p.startsWith('bin/'))).toBe(true);
  });

  it('includes the CLI name in package.json', async () => {
    const files = await generateProject(sampleStructure);
    const pkg = files.find((f) => f.relativePath === 'package.json')!;
    expect(pkg.content).toContain('"my-api-cli"');
  });

  it('registers group commands in index.ts', async () => {
    const files = await generateProject(sampleStructure);
    const index = files.find((f) => f.relativePath === 'src/index.ts')!;
    expect(index.content).toContain('registerUsersCommands');
  });

  it('generates optional option with square brackets for non-boolean', async () => {
    const files = await generateProject(sampleStructure);
    const userCmd = files.find((f) => f.relativePath === 'src/commands/users.ts')!;
    expect(userCmd.content).toContain('--limit [limit]');
  });

  it('generates boolean option without value placeholder', async () => {
    const files = await generateProject(sampleStructure);
    const userCmd = files.find((f) => f.relativePath === 'src/commands/users.ts')!;
    // Boolean option should not have <value> or [value]
    expect(userCmd.content).toContain("'--verbose-mode'");
    expect(userCmd.content).not.toContain('--verbose-mode <');
    expect(userCmd.content).not.toContain('--verbose-mode [');
  });

  it('generates enum option with choices', async () => {
    const files = await generateProject(sampleStructure);
    const userCmd = files.find((f) => f.relativePath === 'src/commands/users.ts')!;
    expect(userCmd.content).toContain('"active"');
    expect(userCmd.content).toContain('"inactive"');
    expect(userCmd.content).toContain('.choices(');
  });

  it('generates required option with angle brackets', async () => {
    const files = await generateProject(sampleStructure);
    const userCmd = files.find((f) => f.relativePath === 'src/commands/users.ts')!;
    expect(userCmd.content).toContain('--data <data>');
  });

  it('uses optsWithGlobals in generated command action', async () => {
    const files = await generateProject(sampleStructure);
    const userCmd = files.find((f) => f.relativePath === 'src/commands/users.ts')!;
    expect(userCmd.content).toContain('optsWithGlobals');
  });

  it('generates auth env var reference in api-client.ts', async () => {
    const files = await generateProject(sampleStructure);
    const client = files.find((f) => f.relativePath === 'src/lib/api-client.ts')!;
    expect(client.content).toContain('API_TOKEN');
    expect(client.content).toContain('Bearer');
  });

  it('generates a bin file with a shebang', async () => {
    const files = await generateProject(sampleStructure);
    const bin = files.find((f) => f.relativePath.startsWith('bin/'))!;
    expect(bin.content).toMatch(/^#!\/usr\/bin\/env node/);
  });

  it('includes auth scheme names comment in api-client.ts', async () => {
    const files = await generateProject(sampleStructure);
    const client = files.find((f) => f.relativePath === 'src/lib/api-client.ts')!;
    expect(client.content).toContain('bearerAuth');
  });
});
