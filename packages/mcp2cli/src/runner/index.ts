import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { Command, Option } from 'commander';
import chalk from 'chalk';
import jmespath from 'jmespath';
import { getCachedTools, setCachedTools } from '../cache';
import {
  McpServerConfig,
  ToolParam,
  ToolDefinition,
  JsonSchemaProperty,
  JsonErrorEnvelope,
  JsonSuccessEnvelope,
  EXIT_INVALID_ARGS,
  EXIT_TOOL_EXECUTION,
} from '../types/index';

const DEFAULT_CACHE_TTL = 3600;

/** Convert camelCase or snake_case property name to kebab-case CLI flag */
export function toKebabCase(name: string): string {
  return name
    .replace(/_/g, '-')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase();
}

/** Resolve the primary type from a JSON Schema type field (string or array) */
function resolveType(
  schemaProp: JsonSchemaProperty
): 'string' | 'number' | 'boolean' | 'array' {
  const raw = schemaProp.type;
  const primary = Array.isArray(raw)
    ? (raw.find((t) => t !== 'null') ?? 'string')
    : raw ?? 'string';

  if (primary === 'integer' || primary === 'number') return 'number';
  if (primary === 'boolean') return 'boolean';
  if (primary === 'array') return 'array';
  return 'string';
}

/** Build ToolParam list from a tool's inputSchema */
export function schemaToParams(tool: ToolDefinition): ToolParam[] {
  const schema = tool.inputSchema;
  const properties = schema.properties ?? {};
  const required = new Set(schema.required ?? []);

  return Object.entries(properties).map(([name, prop]) => {
    const type = resolveType(prop);
    const param: ToolParam = {
      name,
      cliFlag: toKebabCase(name),
      type,
      description: prop.description ?? '',
      required: required.has(name),
      defaultValue: prop.default,
      enumValues: prop.enum,
    };
    if (type === 'array' && prop.items) {
      param.itemsType = resolveType(prop.items) as 'string' | 'number' | 'boolean';
    }
    return param;
  });
}

/**
 * Fetch tools from the MCP server, using cache when available.
 */
export async function getTools(
  client: Client,
  config: McpServerConfig,
  options: { noCache?: boolean; cacheTtl?: number; debug?: boolean }
): Promise<ToolDefinition[]> {
  const ttl = options.cacheTtl ?? DEFAULT_CACHE_TTL;
  const debug = !!options.debug;

  if (!options.noCache) {
    const cached = await getCachedTools(config, ttl);
    if (cached) {
      if (debug) {
        console.error(chalk.gray(`[debug] Loaded ${cached.length} tool(s) from cache (TTL: ${ttl}s)`));
      }
      return cached;
    }
  }

  if (debug) {
    console.error(chalk.gray(`[debug] Fetching tool list from server…`));
  }

  const allTools: ToolDefinition[] = [];
  let cursor: string | undefined;
  do {
    const result = await client.listTools({ cursor });
    allTools.push(...(result.tools as ToolDefinition[]));
    cursor = result.nextCursor;
  } while (cursor);

  if (debug) {
    console.error(chalk.gray(`[debug] Fetched ${allTools.length} tool(s): ${allTools.map((t) => t.name).join(', ')}`));
  }

  if (!options.noCache) {
    await setCachedTools(config, allTools, ttl);
  }
  return allTools;
}

/** Format a single parameter as a human-readable line */
function formatParamLine(p: ToolParam): string {
  const flag = p.required ? chalk.yellow(`--${p.cliFlag}`) : `--${p.cliFlag}`;
  const typeBadge = chalk.magenta(`<${p.type}>`);
  const reqBadge = p.required ? chalk.red('[required]') : chalk.gray('[optional]');
  const parts = [`      ${flag} ${typeBadge} ${reqBadge}`];
  if (p.description) parts[0] += `  ${p.description}`;
  if (p.defaultValue !== undefined) parts[0] += chalk.gray(` (default: ${JSON.stringify(p.defaultValue)})`);
  if (p.enumValues) parts[0] += chalk.gray(` (choices: ${p.enumValues.join(', ')})`);
  return parts[0];
}

/**
 * Print a formatted list of all tools.
 */
export function printToolList(tools: ToolDefinition[]): void {
  if (tools.length === 0) {
    console.log(chalk.yellow('No tools available.'));
    return;
  }
  console.log(chalk.bold(`\nAvailable tools (${tools.length}):\n`));
  for (const tool of tools) {
    console.log(`  ${chalk.cyan(tool.name)}`);
    if (tool.description) {
      console.log(`    ${chalk.gray(tool.description)}`);
    }
    const params = schemaToParams(tool);
    if (params.length > 0) {
      console.log(`    ${chalk.bold('Parameters:')}`);
      for (const p of params) {
        console.log(formatParamLine(p));
      }
    }
    console.log();
  }
}

/**
 * Print a human-readable detailed description of a single tool,
 * including its parameters with type, required status, and description.
 */
export function describeTool(tool: ToolDefinition): void {
  console.log(chalk.bold(`\nTool: ${chalk.cyan(tool.name)}\n`));
  if (tool.description) {
    console.log(`  ${tool.description}\n`);
  }
  const params = schemaToParams(tool);
  if (params.length === 0) {
    console.log(chalk.gray('  No parameters.\n'));
    return;
  }
  console.log(chalk.bold('  Parameters:\n'));
  for (const p of params) {
    console.log(formatParamLine(p));
  }
  console.log();
}

/**
 * Print tool list as machine-readable JSON for agent consumption.
 * Each tool includes its full parameter schema so agents can introspect
 * available capabilities without additional calls.
 */
export function printToolListJson(tools: ToolDefinition[]): void {
  const items = tools.map((tool) => {
    const params = schemaToParams(tool);
    return {
      name: tool.name,
      description: tool.description ?? '',
      parameters: params.map((p) => ({
        name: p.name,
        cliFlag: `--${p.cliFlag}`,
        type: p.type,
        required: p.required,
        description: p.description,
        ...(p.defaultValue !== undefined ? { default: p.defaultValue } : {}),
        ...(p.enumValues ? { enum: p.enumValues } : {}),
        ...(p.itemsType ? { itemsType: p.itemsType } : {}),
      })),
      inputSchema: tool.inputSchema,
    };
  });
  const envelope: JsonSuccessEnvelope = {
    ok: true,
    result: { tools: items, count: items.length },
  };
  console.log(JSON.stringify(envelope));
}

/**
 * Return a detailed JSON description of a single tool, including its full
 * input schema and CLI flag mapping.  Designed for agent introspection.
 */
export function describeToolJson(tool: ToolDefinition): void {
  const params = schemaToParams(tool);
  const envelope: JsonSuccessEnvelope = {
    ok: true,
    result: {
      name: tool.name,
      description: tool.description ?? '',
      parameters: params.map((p) => ({
        name: p.name,
        cliFlag: `--${p.cliFlag}`,
        type: p.type,
        required: p.required,
        description: p.description,
        ...(p.defaultValue !== undefined ? { default: p.defaultValue } : {}),
        ...(p.enumValues ? { enum: p.enumValues } : {}),
        ...(p.itemsType ? { itemsType: p.itemsType } : {}),
      })),
      inputSchema: tool.inputSchema,
    },
  };
  console.log(JSON.stringify(envelope));
}

/**
 * Emit a structured JSON error to stderr (when --json is active).
 */
export function emitJsonError(
  code: string,
  message: string,
  exitCode: number,
  suggestions?: string[],
): void {
  const envelope: JsonErrorEnvelope = {
    ok: false,
    error: { code, message, exitCode, ...(suggestions?.length ? { suggestions } : {}) },
  };
  process.stderr.write(JSON.stringify(envelope) + '\n');
}

/**
 * Parse a JSON string into a tool arguments object.
 * Validates that the input is a plain object (not array/null/primitive).
 */
export function parseInputJson(jsonStr: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error(`Invalid JSON in --input-json: ${jsonStr}`);
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('--input-json must be a JSON object (e.g. {"key": "value"})');
  }
  return parsed as Record<string, unknown>;
}

/** Format and print tool result content */
function formatResult(result: unknown, options: { raw?: boolean; json?: boolean; jq?: string }): void {
  let data: unknown = result;

  if (options.jq) {
    try {
      data = jmespath.search(data as Record<string, unknown>, options.jq);
    } catch (err) {
      if (options.json) {
        emitJsonError('JMESPATH_ERROR', `JMESPath error in "${options.jq}": ${(err as Error).message}`, EXIT_INVALID_ARGS);
        process.exit(EXIT_INVALID_ARGS);
      }
      console.error(chalk.red(`JMESPath error in "${options.jq}": ${(err as Error).message}`));
      process.exit(EXIT_INVALID_ARGS);
    }
  }

  if (options.json) {
    const envelope: JsonSuccessEnvelope = { ok: true, result: data };
    console.log(JSON.stringify(envelope));
    return;
  }

  if (options.raw) {
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  // Pretty-print: handle MCP content blocks
  if (
    data &&
    typeof data === 'object' &&
    'content' in (data as Record<string, unknown>)
  ) {
    const content = (data as { content: unknown[] }).content;
    if (Array.isArray(content)) {
      for (const block of content) {
        if (
          block &&
          typeof block === 'object' &&
          'type' in (block as Record<string, unknown>)
        ) {
          const b = block as { type: string; text?: string; mimeType?: string; uri?: string };
          if (b.type === 'text' && b.text !== undefined) {
            console.log(b.text);
          } else if (b.type === 'image') {
            console.log(chalk.gray(`[image: ${b.mimeType ?? 'unknown'}]`));
          } else if (b.type === 'resource') {
            console.log(chalk.gray(`[resource: ${b.uri ?? 'unknown'}]`));
          } else {
            console.log(JSON.stringify(block, null, 2));
          }
        }
      }
      return;
    }
  }

  // Fallback: pretty JSON
  console.log(JSON.stringify(data, null, 2));
}

/** Coerce a CLI string value to the expected type */
export function coerceValue(value: string, type: ToolParam['type']): unknown {
  if (type === 'number') {
    const num = Number(value);
    if (!Number.isFinite(num)) {
      throw new Error(`Invalid value for numeric parameter: "${value}"`);
    }
    return num;
  }
  if (type === 'boolean') {
    const falsy = ['false', '0', 'no', 'off', ''];
    return !falsy.includes(value.toLowerCase());
  }
  if (type === 'array') {
    // Accept comma-separated or JSON array string
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // fall through
    }
    return value.split(',').map((s) => s.trim());
  }
  return value;
}

/**
 * Execute a named tool with the given client.
 * Dynamically builds a subcommand from the tool's schema, parses args, calls the tool.
 * When `inputJson` is provided the args are taken directly from the JSON object,
 * bypassing Commander parsing — this is the preferred mode for agent callers.
 */
export async function runTool(
  client: Client,
  tool: ToolDefinition,
  rawArgs: string[],
  options: { raw?: boolean; json?: boolean; jq?: string; inputJson?: string }
): Promise<void> {
  let toolArgs: Record<string, unknown>;

  if (options.inputJson) {
    // --input-json mode: accept a raw JSON object as tool arguments
    try {
      toolArgs = parseInputJson(options.inputJson);
    } catch (err) {
      if (options.json) {
        emitJsonError('INVALID_INPUT_JSON', (err as Error).message, EXIT_INVALID_ARGS);
        process.exit(EXIT_INVALID_ARGS);
      }
      console.error(chalk.red(`Error: ${(err as Error).message}`));
      process.exit(EXIT_INVALID_ARGS);
    }
  } else {
    // Standard CLI flag parsing mode
    const params = schemaToParams(tool);
    const sub = new Command(tool.name);
    if (tool.description) sub.description(tool.description);

    for (const param of params) {
      let flagStr: string;
      if (param.type === 'boolean') {
        flagStr = `--${param.cliFlag}`;
      } else if (param.type === 'array') {
        flagStr = `--${param.cliFlag} <values...>`;
      } else {
        flagStr = `--${param.cliFlag} <value>`;
      }

      const opt = new Option(flagStr, param.description);
      if (param.required) opt.makeOptionMandatory(true);
      if (param.defaultValue !== undefined) opt.default(param.defaultValue);
      if (param.enumValues) opt.choices(param.enumValues);
      sub.addOption(opt);
    }

    sub.allowUnknownOption(false);
    sub.exitOverride();
    sub.configureOutput({
      writeErr: (str: string) => { process.stderr.write(str); },
    });

    try {
      sub.parse(['node', tool.name, ...rawArgs]);
    } catch (err) {
      const e = err as { code?: string; message?: string };
      if (e.code === 'commander.missingMandatoryOptionValue' || e.code === 'commander.optionMissingArgument') {
        if (options.json) {
          emitJsonError('MISSING_OPTION', e.message ?? 'Missing required option', EXIT_INVALID_ARGS);
          process.exit(EXIT_INVALID_ARGS);
        }
        process.stderr.write(`${e.message ?? 'Missing required option'}\n`);
        process.exit(EXIT_INVALID_ARGS);
      }
      throw err;
    }

    const opts = sub.opts();
    toolArgs = {};
    try {
      for (const param of params) {
        const cliKey = param.cliFlag.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
        const rawVal = opts[cliKey];
        if (rawVal === undefined) continue;
        const itemType = param.itemsType ?? 'string';
        const coerced =
          param.type === 'array' && Array.isArray(rawVal)
            ? rawVal.map((v: string) => coerceValue(v, itemType))
            : typeof rawVal === 'string'
            ? coerceValue(rawVal, param.type)
            : rawVal;
        toolArgs[param.name] = coerced;
      }
    } catch (err) {
      if (options.json) {
        emitJsonError('INVALID_ARGS', (err as Error).message, EXIT_INVALID_ARGS);
        process.exit(EXIT_INVALID_ARGS);
      }
      console.error(chalk.red(`Error: ${(err as Error).message}`));
      process.exit(EXIT_INVALID_ARGS);
    }
  }

  try {
    const result = await client.callTool({ name: tool.name, arguments: toolArgs });
    formatResult(result, options);
  } catch (err) {
    if (options.json) {
      emitJsonError('TOOL_EXECUTION_ERROR', (err as Error).message, EXIT_TOOL_EXECUTION);
      process.exit(EXIT_TOOL_EXECUTION);
    }
    throw err;
  }
}
