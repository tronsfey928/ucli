import { Command, Option as CommanderOption } from 'commander';
import chalk from 'chalk';
import _ from 'lodash';
import * as fse from 'fs-extra';
import * as path from 'path';
import { parseOASWithCache } from '../cache';
import { analyzeSchema } from '../analyzer/schema-analyzer';
import {
  SubCommand, CommandGroup, CommandStructure, RuntimeClient,
  AgentEnvelope, OperationInfo, OperationDetail, DryRunResult,
} from '../types/index';
import { createRuntimeClient, RuntimeAuth, RuntimeClientOptions } from './http-client';
import { formatOutput } from './output';
import { HttpClientError, InputValidationError, SpecParseError } from '../errors';

// Debug logging helper — only emits when --debug is active.
let debugEnabled = false;
function debugLog(msg: string, ...args: unknown[]): void {
  if (!debugEnabled) return;
  console.error(chalk.dim('[debug]'), msg, ...args);
}

export interface ProxyOpts {
  oas: string;
  bearer?: string;
  apiKey?: string;
  apiKeyHeader?: string;
  basic?: string;
  header?: string[];
  endpoint?: string;
  timeout?: number;
  retries?: number;
  noCache?: boolean;
  cacheTtl?: number;
  machine?: boolean;
  dryRun?: boolean;
  debug?: boolean;
}

// Parse "Name: Value" strings into a header map.
function parseExtraHeaders(headers: string[] | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  for (const h of headers ?? []) {
    const idx = h.indexOf(':');
    if (idx === -1) continue;
    result[h.slice(0, idx).trim()] = h.slice(idx + 1).trim();
  }
  return result;
}

// Commander stores option values with camelCase keys derived from the flag name.
// e.g., --per-page → opts.perPage, --owner → opts.owner
function optsKey(flagName: string): string {
  return _.camelCase(flagName);
}

// Format an HTTP or network error with contextual hints.
function formatHttpError(
  err: unknown,
  method: string,
  fullUrl: string,
): HttpClientError {
  const axErr = err as {
    response?: { status: number; statusText: string; data: unknown };
    code?: string;
    message?: string;
    name?: string;
  };

  if (axErr.response) {
    const { status, statusText, data } = axErr.response;
    let hint = '';
    if (status === 401 || status === 403) {
      hint = 'Check your --bearer / --api-key / --basic credentials';
    } else if (status === 404) {
      hint = 'Endpoint not found — verify the operation name and path params';
    } else if (status >= 500) {
      hint = 'Server error — the API returned a 5xx response';
    }
    const message = `[HTTP ${status} ${statusText}] ${method.toUpperCase()} ${fullUrl}${hint ? ` → ${hint}` : ''}`;
    return new HttpClientError(message, {
      statusCode: status,
      statusText,
      responseData: data,
      cause: err,
    });
  }

  if (axErr.name === 'AbortError' || axErr.code === 'ETIMEDOUT') {
    return new HttpClientError(
      `[Timeout] ${method.toUpperCase()} ${fullUrl} → Request timed out — use --timeout <ms> to increase the limit`,
      { errorCode: 'ETIMEDOUT', cause: err },
    );
  }

  if (axErr.code === 'ECONNREFUSED') {
    return new HttpClientError(
      `[Connection Refused] ${method.toUpperCase()} ${fullUrl} → Is the API server running and reachable?`,
      { errorCode: 'ECONNREFUSED', cause: err },
    );
  }

  if (axErr.code === 'ENOTFOUND') {
    return new HttpClientError(
      `[DNS Error] ${method.toUpperCase()} ${fullUrl} → Hostname not found — check the --endpoint URL or spec server URL`,
      { errorCode: 'ENOTFOUND', cause: err },
    );
  }

  return new HttpClientError(
    axErr.message ?? String(err),
    { errorCode: axErr.code, cause: err },
  );
}

// Coerce a Commander string value to the appropriate JS type based on OAS schema type.
function coerceValue(val: unknown, oasType: string): unknown {
  if (typeof val !== 'string') return val;
  if (oasType === 'integer' || oasType === 'number') {
    const n = Number(val);
    return Number.isNaN(n) ? val : n;
  }
  if (oasType === 'boolean') {
    if (val === 'true') return true;
    if (val === 'false') return false;
    return val;
  }
  return val;
}

// ─── Agent / Machine-mode helpers ─────────────────────────────────────────────

/** Emit a structured JSON envelope to stdout (for --machine mode). */
function emitEnvelope(envelope: AgentEnvelope): void {
  console.log(JSON.stringify(envelope, null, 2));
}

/** Build an OperationInfo summary from a SubCommand. */
function toOperationInfo(sub: SubCommand, group?: string): OperationInfo {
  return {
    name: sub.name,
    ...(group ? { group } : {}),
    description: sub.description,
    method: sub.method.toUpperCase(),
    path: sub.path,
    ...(sub.streaming ? { streaming: sub.streaming } : {}),
  };
}

/** Build a full OperationDetail from a SubCommand (for `describe`). */
function toOperationDetail(sub: SubCommand, group: string | undefined, baseUrl: string): OperationDetail {
  const params = sub.parameters.map(p => ({
    name: p.name,
    in: p.in,
    type: p.schema.type,
    required: p.required,
    description: p.description,
    ...(p.schema.enum ? { enum: p.schema.enum } : {}),
    ...(p.schema.default !== undefined ? { default: p.schema.default } : {}),
  }));

  const rb = sub.requestBody ? {
    required: sub.requestBody.required,
    contentType: sub.requestBody.contentType,
    fields: sub.requestBody.fields.map(f => ({
      name: f.name,
      type: f.type,
      required: f.required,
      description: f.description,
      ...(f.enum ? { enum: f.enum } : {}),
    })),
  } : undefined;

  const responses = Object.values(sub.responses).map(r => ({
    statusCode: r.statusCode,
    description: r.description,
    contentType: r.contentType,
    fields: r.fields,
    isArray: r.isArray,
  }));

  const options = sub.options.map(o => ({
    flag: `--${o.name}`,
    description: o.description,
    required: o.required,
    type: o.type,
    ...(o.enum ? { enum: o.enum } : {}),
    ...(o.defaultValue !== undefined ? { default: o.defaultValue } : {}),
  }));

  // Build an example command line
  const requiredFlags = sub.options
    .filter(o => o.required)
    .map(o => `--${o.name} <${o.name}>`)
    .join(' ');
  const cmdParts = group ? [group, sub.name] : [sub.name];
  const exampleCommand = `openapi2cli run --oas <spec> ${cmdParts.join(' ')}${requiredFlags ? ' ' + requiredFlags : ''}`;

  return {
    name: sub.name,
    ...(group ? { group } : {}),
    description: sub.description,
    method: sub.method.toUpperCase(),
    path: sub.path,
    ...(sub.streaming ? { streaming: sub.streaming } : {}),
    parameters: params,
    ...(rb ? { requestBody: rb } : {}),
    responses,
    authentication: sub.securitySchemes,
    options,
    exampleCommand,
  };
}

/** Emit a structured JSON listing of all operations. */
function listOperationsJSON(structure: CommandStructure): void {
  const operations: OperationInfo[] = [];
  for (const group of structure.groups) {
    for (const sub of group.subcommands) {
      operations.push(toOperationInfo(sub, group.name));
    }
  }
  for (const sub of structure.flatCommands) {
    operations.push(toOperationInfo(sub));
  }

  emitEnvelope({
    success: true,
    data: {
      apiName: structure.name !== '_proxy_' ? structure.name : undefined,
      description: structure.description,
      version: structure.version,
      baseUrl: structure.baseUrl,
      totalOperations: operations.length,
      groups: structure.groups.map(g => ({ name: g.name, description: g.description, operationCount: g.subcommands.length })),
      operations,
    },
  });
}

/** Find a SubCommand by name, optionally within a specific group. */
function findOperation(
  structure: CommandStructure,
  args: string[],
): { sub: SubCommand; group?: string } | null {
  if (args.length === 1) {
    // Search flat commands first, then all groups
    const flat = structure.flatCommands.find(s => s.name === args[0]);
    if (flat) return { sub: flat };
    for (const g of structure.groups) {
      const sub = g.subcommands.find(s => s.name === args[0]);
      if (sub) return { sub, group: g.name };
    }
    return null;
  }
  if (args.length >= 2) {
    const group = structure.groups.find(g => g.name === args[0]);
    if (!group) return null;
    const sub = group.subcommands.find(s => s.name === args[1]);
    if (!sub) return null;
    return { sub, group: group.name };
  }
  return null;
}

/** Handle the `describe` introspection subcommand. */
function describeOperation(
  structure: CommandStructure,
  args: string[],
  baseUrl: string,
  machine: boolean,
): void {
  if (args.length === 0) {
    if (machine) {
      emitEnvelope({
        success: false,
        error: {
          type: 'InputValidationError',
          message: 'Usage: describe <operation> or describe <group> <operation>',
          hint: 'Run without arguments to list all available operations.',
        },
      });
    } else {
      console.error(chalk.red('Usage:'), 'describe <operation> or describe <group> <operation>');
    }
    return;
  }

  const found = findOperation(structure, args);
  if (!found) {
    const msg = `Operation not found: ${args.join(' ')}`;
    if (machine) {
      emitEnvelope({
        success: false,
        error: {
          type: 'InputValidationError',
          message: msg,
          hint: 'Run without arguments to list all available operations.',
        },
      });
    } else {
      console.error(chalk.red('Error:'), msg);
    }
    return;
  }

  const detail = toOperationDetail(found.sub, found.group, baseUrl);

  if (machine) {
    emitEnvelope({ success: true, data: detail });
  } else {
    // Pretty-print for human users
    console.log(chalk.bold(detail.name) + chalk.dim(` — ${detail.description}`));
    console.log(`  ${chalk.cyan(detail.method)} ${detail.path}`);
    if (detail.parameters.length > 0) {
      console.log(chalk.bold('\n  Parameters:'));
      for (const p of detail.parameters) {
        const req = p.required ? chalk.red('*') : ' ';
        console.log(`    ${req} --${_.kebabCase(p.name)} (${p.type}, in: ${p.in}) ${p.description}`);
      }
    }
    if (detail.requestBody) {
      console.log(chalk.bold('\n  Request Body') + chalk.dim(` [${detail.requestBody.contentType}]:`));
      for (const f of detail.requestBody.fields) {
        const req = f.required ? chalk.red('*') : ' ';
        console.log(`    ${req} --${_.kebabCase(f.name)} (${f.type}) ${f.description}`);
      }
    }
    if (detail.responses.length > 0) {
      console.log(chalk.bold('\n  Responses:'));
      for (const r of detail.responses) {
        console.log(`    ${r.statusCode}: ${r.description}${r.isArray ? ' (array)' : ''}`);
      }
    }
    console.log(chalk.bold('\n  Example:'));
    console.log(`    ${detail.exampleCommand}`);
  }
}

// Apply JMESPath query, returning the filtered result (for machine mode).
function applyJMESPath(data: unknown, query: string): unknown {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const jmespath = require('jmespath');
  return jmespath.search(data, query);
}

// Build and execute the HTTP call for a matched operation.
async function executeOperation(
  sub: SubCommand,
  opts: Record<string, unknown>,
  client: RuntimeClient,
  machineMode: boolean,
  dryRunMode: boolean,
  baseURL: string,
): Promise<void> {
  const verbose = (opts['verbose'] as boolean | undefined) ?? false;
  const format = machineMode ? 'json' : ((opts['format'] as string | undefined) ?? 'json');
  const query = opts['query'] as string | undefined;
  const allPages = (opts['allPages'] as boolean | undefined) ?? false;

  const pathParams: Record<string, string> = {};
  const queryParams: Record<string, string> = {};
  const headerParams: Record<string, string> = {};

  for (const param of sub.parameters) {
    const key = optsKey(_.kebabCase(param.name));
    const val = opts[key];
    if (val === undefined || val === null) continue;
    if (param.in === 'path') {
      pathParams[param.name] = String(val);
    } else if (param.in === 'query') {
      queryParams[param.name] = String(val);
    } else if (param.in === 'header') {
      headerParams[param.name] = String(val);
    } else if (param.in === 'cookie') {
      // Accumulate cookie params into a single Cookie header
      const existing = headerParams['Cookie'];
      headerParams['Cookie'] = existing
        ? `${existing}; ${param.name}=${encodeURIComponent(String(val))}`
        : `${param.name}=${encodeURIComponent(String(val))}`;
    }
  }

  const headers = Object.keys(headerParams).length > 0 ? headerParams : undefined;

  // Resolve body: either raw --data or individual field options
  let body: unknown;
  if (opts['data'] !== undefined) {
    const rawData = opts['data'] as string;
    try {
      const jsonText = rawData.startsWith('@')
        ? await fse.readFile(path.resolve(process.cwd(), rawData.slice(1)), 'utf-8')
        : rawData;
      body = JSON.parse(jsonText);
    } catch (parseErr) {
      const detail = parseErr instanceof Error ? parseErr.message : String(parseErr);
      throw new InputValidationError(`Invalid JSON for --data: ${detail}`, parseErr);
    }
  } else if (sub.requestBody) {
    const bodyObj: Record<string, unknown> = {};
    for (const field of sub.requestBody.fields) {
      const val = opts[field.optKey];
      if (val !== undefined) bodyObj[field.name] = coerceValue(val, field.type);
    }
    body = Object.keys(bodyObj).length > 0 ? bodyObj : undefined;
  }

  // Dry-run: emit the planned request without executing
  if (dryRunMode) {
    const resolvedPath = sub.path.replace(/\{([^}]+)\}/g, (_, k: string) => pathParams[k] ?? `{${k}}`);
    const fullUrl = baseURL.replace(/\/$/, '') + resolvedPath;
    const dryResult: DryRunResult = {
      method: sub.method.toUpperCase(),
      url: fullUrl,
      headers: { ...headerParams },
      queryParams,
      ...(body !== undefined ? { body } : {}),
    };
    emitEnvelope({
      success: true,
      data: dryResult,
      meta: {
        operation: sub.name,
        method: sub.method.toUpperCase(),
        path: sub.path,
        baseUrl: baseURL,
      },
    });
    return;
  }

  debugLog('executing %s %s', sub.method.toUpperCase(), sub.path);
  debugLog('  pathParams: %O', pathParams);
  debugLog('  queryParams: %O', queryParams);
  if (headers) debugLog('  headers: %O', headers);
  if (body !== undefined) debugLog('  body: %O', body);

  // Execute the actual request
  const startTime = Date.now();

  if (sub.streaming === 'sse') {
    if (machineMode) {
      const events: string[] = [];
      for await (const event of client.requestStream({ method: sub.method, path: sub.path, pathParams, queryParams, headers, body, verbose })) {
        events.push(event);
      }
      emitEnvelope({
        success: true,
        data: events,
        meta: {
          operation: sub.name,
          method: sub.method.toUpperCase(),
          path: sub.path,
          baseUrl: baseURL,
          durationMs: Date.now() - startTime,
        },
      });
    } else {
      for await (const event of client.requestStream({ method: sub.method, path: sub.path, pathParams, queryParams, headers, body, verbose })) {
        console.log(event);
      }
    }
  } else {
    const result = await client.request({ method: sub.method, path: sub.path, pathParams, queryParams, headers, body, verbose, allPages });
    if (machineMode) {
      emitEnvelope({
        success: true,
        data: query ? applyJMESPath(result, query) : result,
        meta: {
          operation: sub.name,
          method: sub.method.toUpperCase(),
          path: sub.path,
          baseUrl: baseURL,
          durationMs: Date.now() - startTime,
        },
      });
    } else {
      formatOutput(result, format, query);
    }
  }
}

// Register one operation as a Commander subcommand on `parent`.
function registerOperation(
  parent: Command,
  sub: SubCommand,
  client: RuntimeClient,
  baseURL: string,
  machineMode: boolean,
  dryRunMode: boolean,
): void {
  const cmd = new Command(sub.name).description(sub.description);

  for (const alias of sub.aliases ?? []) {
    cmd.alias(alias);
  }

  // Operation-specific options (parameters + body fields + --data)
  for (const opt of sub.options) {
    const flag = opt.type === 'boolean'
      ? `--${opt.name}`
      : `--${opt.name} <value>`;
    const co = new CommanderOption(flag, opt.description);
    if (opt.enum) co.choices(opt.enum);
    if (opt.defaultValue !== undefined) co.default(opt.defaultValue);
    cmd.addOption(co);
  }

  // Per-call output options (match generated CLI behaviour)
  cmd.option('--format <format>', 'Output format: json, yaml, table', 'json');
  cmd.option('--verbose', 'Log HTTP method and URL to stderr', false);
  cmd.option('--query <expr>', 'JMESPath expression to filter the response');
  cmd.option('--all-pages', 'Auto-paginate via Link rel="next" headers', false);

  cmd.action(async (opts: Record<string, unknown>) => {
    // Reconstruct the full URL for error reporting
    const pathParams: Record<string, string> = {};
    for (const param of sub.parameters.filter(p => p.in === 'path')) {
      const key = optsKey(_.kebabCase(param.name));
      const val = opts[key];
      if (val !== undefined && val !== null) pathParams[param.name] = String(val);
    }
    const resolvedPath = sub.path.replace(/\{([^}]+)\}/g, (_, k: string) => pathParams[k] ?? `{${k}}`);
    const fullUrl = baseURL.replace(/\/$/, '') + resolvedPath;

    try {
      await executeOperation(sub, opts, client, machineMode, dryRunMode, baseURL);
    } catch (err) {
      const httpErr = formatHttpError(err, sub.method, fullUrl);
      debugLog('request failed: %s', httpErr.message);
      if (httpErr.statusCode) debugLog('  status: %d', httpErr.statusCode);
      if (httpErr.errorCode) debugLog('  code: %s', httpErr.errorCode);
      if (httpErr.responseData) debugLog('  responseData: %O', httpErr.responseData);
      if (err instanceof Error && err.stack) debugLog('  stack: %s', err.stack);
      if (machineMode) {
        emitEnvelope({
          success: false,
          error: {
            type: httpErr.name,
            message: httpErr.message,
            statusCode: httpErr.statusCode,
            errorCode: httpErr.errorCode,
            responseData: httpErr.responseData,
          },
          meta: {
            operation: sub.name,
            method: sub.method.toUpperCase(),
            path: sub.path,
            baseUrl: baseURL,
          },
        });
        return;
      }
      throw httpErr;
    }
  });

  parent.addCommand(cmd);
}

// Build a Commander program with all operations from the analyzed structure.
function buildOperationsProgram(
  structure: CommandStructure,
  client: RuntimeClient,
  baseURL: string,
  machineMode: boolean,
  dryRunMode: boolean,
): Command {
  const prog = new Command()
    .name('run')
    .description(structure.description || `API proxy for OpenAPI spec`);

  // Suppress Commander's default error exit so we can handle unknown commands gracefully
  prog.exitOverride();

  for (const group of structure.groups) {
    const groupCmd = new Command(group.name)
      .description(group.description)
      .exitOverride();
    for (const sub of group.subcommands) {
      registerOperation(groupCmd, sub, client, baseURL, machineMode, dryRunMode);
    }
    prog.addCommand(groupCmd);
  }

  for (const sub of structure.flatCommands) {
    registerOperation(prog, sub, client, baseURL, machineMode, dryRunMode);
  }

  return prog;
}

// Print a compact listing of all available operations.
function listOperations(structure: CommandStructure): void {
  const title = structure.description || structure.name;
  console.log(chalk.bold(title));
  console.log('');

  if (structure.groups.length === 0 && structure.flatCommands.length === 0) {
    console.log(chalk.dim('  (no operations found in this spec)'));
    return;
  }

  for (const group of structure.groups) {
    console.log(chalk.cyan(`  ${group.name}`) + chalk.dim(` — ${group.description}`));
    for (const sub of group.subcommands) {
      const method = chalk.dim(`[${sub.method.toUpperCase()}]`);
      console.log(`    ${chalk.bold(sub.name)} ${method}  ${sub.description}`);
    }
    console.log('');
  }

  for (const sub of structure.flatCommands) {
    const method = chalk.dim(`[${sub.method.toUpperCase()}]`);
    console.log(`  ${chalk.bold(sub.name)} ${method}  ${sub.description}`);
  }
}

// Entry point called from the `run` subcommand in src/index.ts.
export async function proxyRun(
  proxyOpts: ProxyOpts,
  remainingArgs: string[],
): Promise<void> {
  const machineMode = proxyOpts.machine ?? proxyOpts.dryRun ?? false;
  const dryRunMode = proxyOpts.dryRun ?? false;
  debugEnabled = proxyOpts.debug ?? false;

  debugLog('proxy opts: %O', {
    ...proxyOpts,
    bearer: proxyOpts.bearer ? '***' : undefined,
    apiKey: proxyOpts.apiKey ? '***' : undefined,
    basic: proxyOpts.basic ? '***' : undefined,
  });
  debugLog('remaining args: %O', remainingArgs);

  // Load and analyse the spec (name is irrelevant in proxy mode)
  let api;
  try {
    debugLog('loading spec from %s (noCache=%s, ttl=%ss)', proxyOpts.oas, !!proxyOpts.noCache, proxyOpts.cacheTtl ?? 3600);
    api = await parseOASWithCache(proxyOpts.oas, {
      noCache: proxyOpts.noCache,
      ttlMs: (proxyOpts.cacheTtl ?? 3600) * 1000,
    });
    debugLog('spec loaded successfully');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    let hint = '';
    if (/ENOTFOUND|ECONNREFUSED/.test(msg)) {
      hint = ' → Is the spec URL reachable? Try --no-cache to force a fresh fetch.';
    }
    debugLog('spec load failed: %s', msg);
    if (stack) debugLog('stack: %s', stack);
    if (machineMode) {
      emitEnvelope({
        success: false,
        error: {
          type: 'SpecParseError',
          message: `Failed to load spec: ${msg}${hint}`,
        },
      });
      return;
    }
    throw new SpecParseError(`Failed to load spec: ${msg}${hint}`, err);
  }
  const structure = analyzeSchema(api, '_proxy_');
  debugLog('analyzed spec: %d groups, %d flat commands', structure.groups.length, structure.flatCommands.length);

  const baseURL = proxyOpts.endpoint ?? structure.baseUrl;
  debugLog('base URL: %s', baseURL);
  const auth: RuntimeAuth = {
    bearer: proxyOpts.bearer,
    apiKey: proxyOpts.apiKey,
    apiKeyHeader: proxyOpts.apiKeyHeader,
    basic: proxyOpts.basic,
    extraHeaders: parseExtraHeaders(proxyOpts.header),
  };
  const clientOpts: RuntimeClientOptions = {
    timeout: proxyOpts.timeout ?? 30_000,
    maxRetries: proxyOpts.retries ?? 3,
  };
  const client = createRuntimeClient(baseURL, auth, clientOpts);

  // No operation given → list available commands
  if (remainingArgs.length === 0) {
    debugLog('no operation given — listing operations');
    if (machineMode) {
      listOperationsJSON(structure);
    } else {
      listOperations(structure);
    }
    return;
  }

  // Handle `describe` / `help` introspection subcommand
  if (remainingArgs[0] === 'describe' || remainingArgs[0] === 'help') {
    debugLog('introspection subcommand: %s %s', remainingArgs[0], remainingArgs.slice(1).join(' '));
    describeOperation(structure, remainingArgs.slice(1), baseURL, machineMode);
    return;
  }

  debugLog('routing to operation: %s', remainingArgs.join(' '));
  const prog = buildOperationsProgram(structure, client, baseURL, machineMode, dryRunMode);

  try {
    await prog.parseAsync(['node', 'run', ...remainingArgs]);
  } catch (err) {
    // exitOverride turns Commander errors into thrown exceptions
    const cmdErr = err as { code?: string; message?: string };
    if (cmdErr.code === 'commander.unknownCommand') {
      const errorMsg = `Unknown command: ${remainingArgs.join(' ')}. Run without an operation to list available commands.`;
      debugLog('unknown command: %s', remainingArgs.join(' '));
      if (machineMode) {
        emitEnvelope({
          success: false,
          error: {
            type: 'InputValidationError',
            message: errorMsg,
            hint: 'Run without arguments to list all available operations.',
          },
        });
        return;
      }
      throw new InputValidationError(errorMsg);
    }
    if (cmdErr.code?.startsWith('commander.')) {
      // Help display etc. — already printed by Commander
      return;
    }
    throw err;
  }
}
