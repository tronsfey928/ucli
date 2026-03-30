import {
  toKebabCase,
  schemaToParams,
  coerceValue,
  printToolListJson,
  describeTool,
  describeToolJson,
  emitJsonError,
  parseInputJson,
} from '../src/runner/index';
import { ToolDefinition } from '../src/types/index';

describe('toKebabCase', () => {
  test('converts camelCase', () => {
    expect(toKebabCase('camelCase')).toBe('camel-case');
    expect(toKebabCase('myPropertyName')).toBe('my-property-name');
  });

  test('converts snake_case', () => {
    expect(toKebabCase('my_property')).toBe('my-property');
    expect(toKebabCase('some_long_name')).toBe('some-long-name');
  });

  test('leaves lowercase unchanged', () => {
    expect(toKebabCase('query')).toBe('query');
    expect(toKebabCase('limit')).toBe('limit');
  });

  test('handles mixed snake and camel', () => {
    expect(toKebabCase('my_camelCase')).toBe('my-camel-case');
  });
});

describe('schemaToParams', () => {
  const tool: ToolDefinition = {
    name: 'search',
    description: 'Search for things',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        limit: { type: 'integer', description: 'Max results', default: 10 },
        includeDeleted: { type: 'boolean', description: 'Include deleted' },
        tags: { type: 'array', description: 'Filter by tags', items: { type: 'string' } },
      },
      required: ['query'],
    },
  };

  test('returns one param per property', () => {
    const params = schemaToParams(tool);
    expect(params).toHaveLength(4);
  });

  test('preserves original property name', () => {
    const params = schemaToParams(tool);
    expect(params.map((p) => p.name)).toEqual(['query', 'limit', 'includeDeleted', 'tags']);
  });

  test('converts to kebab-case cli flag', () => {
    const params = schemaToParams(tool);
    const flags = params.map((p) => p.cliFlag);
    expect(flags).toEqual(['query', 'limit', 'include-deleted', 'tags']);
  });

  test('marks required correctly', () => {
    const params = schemaToParams(tool);
    const reqMap = Object.fromEntries(params.map((p) => [p.name, p.required]));
    expect(reqMap.query).toBe(true);
    expect(reqMap.limit).toBe(false);
    expect(reqMap.includeDeleted).toBe(false);
    expect(reqMap.tags).toBe(false);
  });

  test('maps integer to number type', () => {
    const params = schemaToParams(tool);
    const limitParam = params.find((p) => p.name === 'limit');
    expect(limitParam?.type).toBe('number');
  });

  test('maps boolean type correctly', () => {
    const params = schemaToParams(tool);
    const boolParam = params.find((p) => p.name === 'includeDeleted');
    expect(boolParam?.type).toBe('boolean');
  });

  test('maps array type correctly', () => {
    const params = schemaToParams(tool);
    const arrayParam = params.find((p) => p.name === 'tags');
    expect(arrayParam?.type).toBe('array');
  });

  test('carries default value', () => {
    const params = schemaToParams(tool);
    const limitParam = params.find((p) => p.name === 'limit');
    expect(limitParam?.defaultValue).toBe(10);
  });

  test('handles tool with no properties', () => {
    const emptyTool: ToolDefinition = {
      name: 'ping',
      inputSchema: { type: 'object' },
    };
    expect(schemaToParams(emptyTool)).toHaveLength(0);
  });

  test('handles nullable types (string|null)', () => {
    const nullableTool: ToolDefinition = {
      name: 'get',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: ['string', 'null'], description: 'ID' },
        },
      },
    };
    const params = schemaToParams(nullableTool);
    expect(params[0].type).toBe('string');
  });

  test('populates itemsType for array with typed items', () => {
    const params = schemaToParams(tool);
    const tagsParam = params.find((p) => p.name === 'tags');
    expect(tagsParam?.itemsType).toBe('string');
  });

  test('populates itemsType as number for integer items', () => {
    const numArrayTool: ToolDefinition = {
      name: 'calc',
      inputSchema: {
        type: 'object',
        properties: {
          values: { type: 'array', description: 'Numbers', items: { type: 'integer' } },
        },
      },
    };
    const params = schemaToParams(numArrayTool);
    expect(params[0].itemsType).toBe('number');
  });

  test('itemsType is undefined for non-array types', () => {
    const params = schemaToParams(tool);
    const queryParam = params.find((p) => p.name === 'query');
    expect(queryParam?.itemsType).toBeUndefined();
  });

  test('carries enum values', () => {
    const enumTool: ToolDefinition = {
      name: 'get',
      inputSchema: {
        type: 'object',
        properties: {
          format: {
            type: 'string',
            description: 'Output format',
            enum: ['json', 'yaml', 'text'],
          },
        },
      },
    };
    const params = schemaToParams(enumTool);
    expect(params[0].enumValues).toEqual(['json', 'yaml', 'text']);
  });
});

describe('coerceValue', () => {
  test('converts valid number string', () => {
    expect(coerceValue('42', 'number')).toBe(42);
    expect(coerceValue('3.14', 'number')).toBe(3.14);
    expect(coerceValue('-1', 'number')).toBe(-1);
  });

  test('throws on invalid number string', () => {
    expect(() => coerceValue('abc', 'number')).toThrow('Invalid value for numeric parameter: "abc"');
    expect(() => coerceValue('Infinity', 'number')).toThrow('Invalid value for numeric parameter');
  });

  test('coerces boolean strings', () => {
    expect(coerceValue('true', 'boolean')).toBe(true);
    expect(coerceValue('yes', 'boolean')).toBe(true);
    expect(coerceValue('false', 'boolean')).toBe(false);
    expect(coerceValue('0', 'boolean')).toBe(false);
    expect(coerceValue('no', 'boolean')).toBe(false);
    expect(coerceValue('off', 'boolean')).toBe(false);
    expect(coerceValue('', 'boolean')).toBe(false);
  });

  test('parses JSON array string', () => {
    expect(coerceValue('["a","b"]', 'array')).toEqual(['a', 'b']);
  });

  test('splits comma-separated array string', () => {
    expect(coerceValue('a,b,c', 'array')).toEqual(['a', 'b', 'c']);
  });

  test('returns string as-is for string type', () => {
    expect(coerceValue('hello', 'string')).toBe('hello');
  });
});

// ---------------------------------------------------------------------------
// printToolListJson
// ---------------------------------------------------------------------------
describe('printToolListJson', () => {
  const sampleTools: ToolDefinition[] = [
    {
      name: 'echo',
      description: 'Echo back input',
      inputSchema: {
        type: 'object',
        properties: { message: { type: 'string', description: 'Message to echo' } },
        required: ['message'],
      },
    },
    {
      name: 'add',
      description: 'Add two numbers',
      inputSchema: {
        type: 'object',
        properties: {
          a: { type: 'number', description: 'First number' },
          b: { type: 'number', description: 'Second number' },
        },
        required: ['a', 'b'],
      },
    },
  ];

  test('outputs valid JSON envelope with ok:true', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation();
    printToolListJson(sampleTools);
    expect(spy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(spy.mock.calls[0][0] as string);
    expect(parsed.ok).toBe(true);
    expect(parsed.result.count).toBe(2);
    expect(parsed.result.tools).toHaveLength(2);
    spy.mockRestore();
  });

  test('includes tool names and descriptions', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation();
    printToolListJson(sampleTools);
    const parsed = JSON.parse(spy.mock.calls[0][0] as string);
    expect(parsed.result.tools[0].name).toBe('echo');
    expect(parsed.result.tools[0].description).toBe('Echo back input');
    expect(parsed.result.tools[1].name).toBe('add');
    spy.mockRestore();
  });

  test('includes parameter details with cliFlag', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation();
    printToolListJson(sampleTools);
    const parsed = JSON.parse(spy.mock.calls[0][0] as string);
    const echoParams = parsed.result.tools[0].parameters;
    expect(echoParams).toHaveLength(1);
    expect(echoParams[0].name).toBe('message');
    expect(echoParams[0].cliFlag).toBe('--message');
    expect(echoParams[0].required).toBe(true);
    spy.mockRestore();
  });

  test('includes inputSchema for each tool', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation();
    printToolListJson(sampleTools);
    const parsed = JSON.parse(spy.mock.calls[0][0] as string);
    expect(parsed.result.tools[0].inputSchema).toBeDefined();
    expect(parsed.result.tools[0].inputSchema.type).toBe('object');
    spy.mockRestore();
  });

  test('outputs empty list correctly', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation();
    printToolListJson([]);
    const parsed = JSON.parse(spy.mock.calls[0][0] as string);
    expect(parsed.ok).toBe(true);
    expect(parsed.result.count).toBe(0);
    expect(parsed.result.tools).toHaveLength(0);
    spy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// describeToolJson
// ---------------------------------------------------------------------------
describe('describeToolJson', () => {
  const tool: ToolDefinition = {
    name: 'search',
    description: 'Search for things',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        limit: { type: 'integer', description: 'Max results', default: 10 },
      },
      required: ['query'],
    },
  };

  test('outputs valid JSON envelope with ok:true', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation();
    describeToolJson(tool);
    expect(spy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(spy.mock.calls[0][0] as string);
    expect(parsed.ok).toBe(true);
    spy.mockRestore();
  });

  test('includes tool name and description', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation();
    describeToolJson(tool);
    const parsed = JSON.parse(spy.mock.calls[0][0] as string);
    expect(parsed.result.name).toBe('search');
    expect(parsed.result.description).toBe('Search for things');
    spy.mockRestore();
  });

  test('includes full parameter details', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation();
    describeToolJson(tool);
    const parsed = JSON.parse(spy.mock.calls[0][0] as string);
    const params = parsed.result.parameters;
    expect(params).toHaveLength(2);
    expect(params[0].name).toBe('query');
    expect(params[0].required).toBe(true);
    expect(params[0].type).toBe('string');
    expect(params[1].name).toBe('limit');
    expect(params[1].required).toBe(false);
    expect(params[1].default).toBe(10);
    spy.mockRestore();
  });

  test('includes inputSchema', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation();
    describeToolJson(tool);
    const parsed = JSON.parse(spy.mock.calls[0][0] as string);
    expect(parsed.result.inputSchema).toEqual(tool.inputSchema);
    spy.mockRestore();
  });

  test('includes enum values in parameters when present', () => {
    const enumTool: ToolDefinition = {
      name: 'format',
      inputSchema: {
        type: 'object',
        properties: {
          format: { type: 'string', description: 'Output format', enum: ['json', 'yaml'] },
        },
      },
    };
    const spy = jest.spyOn(console, 'log').mockImplementation();
    describeToolJson(enumTool);
    const parsed = JSON.parse(spy.mock.calls[0][0] as string);
    expect(parsed.result.parameters[0].enum).toEqual(['json', 'yaml']);
    spy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// emitJsonError
// ---------------------------------------------------------------------------
describe('emitJsonError', () => {
  test('writes JSON to stderr with ok:false', () => {
    const spy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
    emitJsonError('TEST_ERROR', 'Something went wrong', 1);
    expect(spy).toHaveBeenCalledTimes(1);
    const output = spy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output.trim());
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe('TEST_ERROR');
    expect(parsed.error.message).toBe('Something went wrong');
    expect(parsed.error.exitCode).toBe(1);
    spy.mockRestore();
  });

  test('includes suggestions when provided', () => {
    const spy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
    emitJsonError('TOOL_NOT_FOUND', 'Unknown tool', 3, ['echo', 'add']);
    const parsed = JSON.parse((spy.mock.calls[0][0] as string).trim());
    expect(parsed.error.suggestions).toEqual(['echo', 'add']);
    spy.mockRestore();
  });

  test('omits suggestions when empty or undefined', () => {
    const spy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
    emitJsonError('GENERIC', 'An error', 1);
    const parsed = JSON.parse((spy.mock.calls[0][0] as string).trim());
    expect(parsed.error.suggestions).toBeUndefined();
    spy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// parseInputJson
// ---------------------------------------------------------------------------
describe('parseInputJson', () => {
  test('parses valid JSON object', () => {
    const result = parseInputJson('{"query":"test","limit":10}');
    expect(result).toEqual({ query: 'test', limit: 10 });
  });

  test('throws on invalid JSON string', () => {
    expect(() => parseInputJson('not json')).toThrow('Invalid JSON in --input-json');
  });

  test('throws on JSON array', () => {
    expect(() => parseInputJson('[1,2,3]')).toThrow('--input-json must be a JSON object');
  });

  test('throws on JSON null', () => {
    expect(() => parseInputJson('null')).toThrow('--input-json must be a JSON object');
  });

  test('throws on JSON primitive', () => {
    expect(() => parseInputJson('"string"')).toThrow('--input-json must be a JSON object');
  });

  test('accepts nested objects', () => {
    const result = parseInputJson('{"config":{"key":"val"},"items":[1,2]}');
    expect(result).toEqual({ config: { key: 'val' }, items: [1, 2] });
  });

  test('accepts empty object', () => {
    const result = parseInputJson('{}');
    expect(result).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// describeTool (human-readable)
// ---------------------------------------------------------------------------
describe('describeTool', () => {
  const tool: ToolDefinition = {
    name: 'search',
    description: 'Search for things',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        limit: { type: 'integer', description: 'Max results', default: 10 },
        format: { type: 'string', description: 'Output format', enum: ['json', 'yaml'] },
      },
      required: ['query'],
    },
  };

  test('outputs tool name', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation();
    describeTool(tool);
    const output = spy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('search');
    spy.mockRestore();
  });

  test('outputs tool description', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation();
    describeTool(tool);
    const output = spy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('Search for things');
    spy.mockRestore();
  });

  test('outputs parameter descriptions', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation();
    describeTool(tool);
    const output = spy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('Search query');
    expect(output).toContain('Max results');
    spy.mockRestore();
  });

  test('outputs parameter types', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation();
    describeTool(tool);
    const output = spy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('<string>');
    expect(output).toContain('<number>');
    spy.mockRestore();
  });

  test('shows required/optional badges', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation();
    describeTool(tool);
    const output = spy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('[required]');
    expect(output).toContain('[optional]');
    spy.mockRestore();
  });

  test('shows default values', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation();
    describeTool(tool);
    const output = spy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('default: 10');
    spy.mockRestore();
  });

  test('shows enum choices', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation();
    describeTool(tool);
    const output = spy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('json, yaml');
    spy.mockRestore();
  });

  test('handles tool with no parameters', () => {
    const emptyTool: ToolDefinition = {
      name: 'ping',
      inputSchema: { type: 'object' },
    };
    const spy = jest.spyOn(console, 'log').mockImplementation();
    describeTool(emptyTool);
    const output = spy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('No parameters');
    spy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// printToolList (enhanced with parameter details)
// ---------------------------------------------------------------------------
describe('printToolList enhanced', () => {
  const tools: ToolDefinition[] = [
    {
      name: 'search',
      description: 'Search for things',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
          limit: { type: 'integer', description: 'Max results', default: 10 },
        },
        required: ['query'],
      },
    },
  ];

  test('shows parameter descriptions in tool list', () => {
    const { printToolList } = require('../src/runner/index');
    const spy = jest.spyOn(console, 'log').mockImplementation();
    printToolList(tools);
    const output = spy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('Search query');
    expect(output).toContain('Max results');
    spy.mockRestore();
  });

  test('shows parameter types in tool list', () => {
    const { printToolList } = require('../src/runner/index');
    const spy = jest.spyOn(console, 'log').mockImplementation();
    printToolList(tools);
    const output = spy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('<string>');
    expect(output).toContain('<number>');
    spy.mockRestore();
  });

  test('shows required/optional in tool list', () => {
    const { printToolList } = require('../src/runner/index');
    const spy = jest.spyOn(console, 'log').mockImplementation();
    printToolList(tools);
    const output = spy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('[required]');
    expect(output).toContain('[optional]');
    spy.mockRestore();
  });
});
