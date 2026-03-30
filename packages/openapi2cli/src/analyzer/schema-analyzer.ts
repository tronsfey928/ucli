import { OpenAPIV3 } from 'openapi-types';
import _ from 'lodash';
import { pinyin } from 'pinyin-pro';
import { extractAuthConfig } from '../auth/auth-provider';
import {
  APIResponse,
  CommandGroup,
  CommandStructure,
  HTTPMethod,
  Option,
  Parameter,
  RequestBody,
  RequestBodyField,
  ResponseField,
  SubCommand,
} from '../types/index';

const HTTP_METHODS: HTTPMethod[] = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];

/** True if the string contains at least one CJK unified ideograph. */
const CJK_RE = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/;

/**
 * Convert CJK characters in a string to their pinyin romanization.
 * Non-CJK characters are left unchanged. Tone marks are stripped.
 * e.g. "创建用户" → "chuang jian yong hu"
 *      "getUserList" → "getUserList"  (no-op)
 */
function cjkToLatin(s: string): string {
  if (!CJK_RE.test(s)) return s;
  return pinyin(s, { toneType: 'none', separator: ' ' });
}

export function analyzeSchema(api: OpenAPIV3.Document, cliName: string): CommandStructure {
  const warnings: string[] = [];
  const { groups, flatCommands } = buildGroups(api, warnings);
  const { authConfig, allAuthSchemes } = extractAuthConfig(api, cliName);
  const baseUrl = extractBaseUrl(api);

  return {
    name: cliName,
    description: api.info.description ?? `CLI for ${api.info.title}`,
    version: api.info.version,
    baseUrl,
    groups,
    flatCommands,
    globalOptions: buildGlobalOptions(),
    authConfig,
    allAuthSchemes,
    warnings,
  };
}

function buildGroups(
  api: OpenAPIV3.Document,
  warnings: string[]
): { groups: CommandGroup[]; flatCommands: SubCommand[] } {
  const groupMap = new Map<string, CommandGroup>();
  const flatCommands: SubCommand[] = [];

  // Seed from top-level tags (preserves defined order and descriptions)
  for (const tag of api.tags ?? []) {
    const converted = cjkToLatin(tag.name);
    if (CJK_RE.test(tag.name)) {
      const kebab = _.kebabCase(converted);
      warnings.push(`[WARN] Tag "${tag.name}" 包含CJK字符，已自动转换为拼音: "${kebab}"`);
    }
    groupMap.set(tag.name, {
      name: _.kebabCase(converted),
      description: tag.description ?? tag.name,
      subcommands: [],
    });
  }

  // Walk every path and method
  for (const [pathStr, pathItem] of Object.entries(api.paths ?? {})) {
    if (!pathItem) continue;

    const pathLevelParams = (pathItem.parameters ?? []) as OpenAPIV3.ParameterObject[];

    for (const method of HTTP_METHODS) {
      const operation = pathItem[method] as OpenAPIV3.OperationObject | undefined;
      if (!operation) continue;

      // x-cli-ignore: true → skip this operation entirely
      if ((operation as Record<string, unknown>)['x-cli-ignore'] === true) continue;

      const subcommand = buildSubCommand(method, pathStr, operation, pathLevelParams, warnings);
      const tags = operation.tags && operation.tags.length > 0 ? operation.tags : [];

      if (tags.length === 0) {
        flatCommands.push(subcommand);
      } else {
        for (const tag of tags) {
          if (!groupMap.has(tag)) {
            const converted = cjkToLatin(tag);
            if (CJK_RE.test(tag)) {
              const kebab = _.kebabCase(converted);
              warnings.push(`[WARN] Tag "${tag}" 包含CJK字符，已自动转换为拼音: "${kebab}"`);
            }
            groupMap.set(tag, {
              name: _.kebabCase(converted),
              description: tag,
              subcommands: [],
            });
          }
          groupMap.get(tag)?.subcommands.push(subcommand);
        }
      }
    }
  }

  const groups = Array.from(groupMap.values()).filter((g) => g.subcommands.length > 0);

  // Detect and resolve duplicate command names within each group
  for (const group of groups) {
    deduplicateNames(group.subcommands, `group "${group.name}"`, warnings);
  }
  // Detect and resolve duplicate names among flat commands
  deduplicateNames(flatCommands, 'flat commands', warnings);

  return { groups, flatCommands };
}

/**
 * Detect duplicate `name` values in a list of subcommands.
 * When a collision is found, rename by appending `-<method>` and emit a warning.
 */
function deduplicateNames(
  subs: SubCommand[],
  context: string,
  warnings: string[],
): void {
  const seen = new Map<string, number>(); // name → first index
  for (let i = 0; i < subs.length; i++) {
    const name = subs[i].name;
    if (seen.has(name)) {
      const disambiguated = `${name}-${subs[i].method}`;
      warnings.push(
        `[WARN] Duplicate command name "${name}" in ${context}, renamed to "${disambiguated}"`
      );
      subs[i] = { ...subs[i], name: disambiguated };
    } else {
      seen.set(name, i);
    }
  }
}

function buildSubCommand(
  method: HTTPMethod,
  pathStr: string,
  operation: OpenAPIV3.OperationObject,
  pathLevelParams: OpenAPIV3.ParameterObject[],
  warnings: string[]
): SubCommand {
  const name = operationToCommandName(operation, method, pathStr, warnings);

  const opParams = (operation.parameters ?? []) as OpenAPIV3.ParameterObject[];
  const mergedParams = mergeParameters(pathLevelParams, opParams);

  const parameters = mergedParams.map(mapParameter);
  const requestBody = operation.requestBody
    ? mapRequestBody(operation.requestBody as OpenAPIV3.RequestBodyObject)
    : undefined;

  const options = buildOptions(parameters, requestBody);
  const responses = buildResponses(operation.responses ?? {});
  const securitySchemes = (operation.security ?? []).flatMap((s) => Object.keys(s));

  // x-cli-aliases extension: ["ls", "list"]
  const xAliases = (operation as Record<string, unknown>)['x-cli-aliases'];
  const aliases = Array.isArray(xAliases) ? (xAliases as unknown[]).map(String) : [];

  // SSE detection: any 2xx response with text/event-stream content type
  const streaming = detectStreaming(operation.responses ?? {});

  return {
    name,
    description:
      operation.summary ?? operation.description ?? `${method.toUpperCase()} ${pathStr}`,
    method,
    path: pathStr,
    parameters,
    requestBody,
    responses,
    options,
    securitySchemes,
    aliases,
    streaming,
  };
}

function operationToCommandName(
  operation: OpenAPIV3.OperationObject,
  method: HTTPMethod,
  pathStr: string,
  warnings: string[]
): string {
  // x-cli-name extension takes highest priority
  const xCliName = (operation as Record<string, unknown>)['x-cli-name'];
  if (typeof xCliName === 'string' && xCliName) {
    return _.kebabCase(cjkToLatin(xCliName));
  }

  if (operation.operationId) {
    const hasCJK = CJK_RE.test(operation.operationId);
    const converted = cjkToLatin(operation.operationId);
    const name = _.kebabCase(converted);
    if (hasCJK) {
      warnings.push(
        `[WARN] operationId "${operation.operationId}" 包含CJK字符，已自动转换为拼音: "${name}"`
      );
    }
    return name;
  }

  // No operationId → path segments + method joined with underscores
  const segments = pathStr
    .split('/')
    .filter((s) => s)
    .map((seg) => {
      const raw = seg.startsWith('{') && seg.endsWith('}') ? seg.slice(1, -1) : seg;
      return _.snakeCase(cjkToLatin(raw));
    });
  const name = [...segments, method].join('_');
  warnings.push(
    `[WARN] ${method.toUpperCase()} ${pathStr} 缺少 operationId，已使用路径+方法自动生成命令名: "${name}"`
  );
  return name;
}

function mergeParameters(
  pathLevel: OpenAPIV3.ParameterObject[],
  opLevel: OpenAPIV3.ParameterObject[]
): OpenAPIV3.ParameterObject[] {
  const map = new Map<string, OpenAPIV3.ParameterObject>();
  for (const p of pathLevel) map.set(`${p.in}:${p.name}`, p);
  for (const p of opLevel) map.set(`${p.in}:${p.name}`, p); // operation wins
  return Array.from(map.values());
}

function mapParameter(p: OpenAPIV3.ParameterObject): Parameter {
  const schema = (p.schema ?? {}) as OpenAPIV3.SchemaObject;
  return {
    name: p.name,
    in: p.in as Parameter['in'],
    description: p.description ?? p.name,
    required: p.required ?? false,
    schema: {
      type: schema.type ?? 'string',
      enum: schema.enum as string[] | undefined,
      default: schema.default,
    },
  };
}

function mapRequestBody(rb: OpenAPIV3.RequestBodyObject): RequestBody {
  const contentKeys = Object.keys(rb.content ?? {});
  const contentType = contentKeys.includes('application/json')
    ? 'application/json'
    : (contentKeys[0] ?? 'application/json');
  const schema = (rb.content?.[contentType]?.schema as OpenAPIV3.SchemaObject) ?? {};
  const requiredFields = (schema.required as string[]) ?? [];
  const properties = (schema.properties ?? {}) as Record<string, OpenAPIV3.SchemaObject>;

  const fields: RequestBodyField[] = Object.entries(properties).map(([name, prop]) => ({
    name,
    // Commander stores opts as camelCase of the kebab-case flag name
    optKey: _.camelCase(_.kebabCase(name)),
    type: prop.type ?? 'string',
    required: requiredFields.includes(name),
    description: prop.description ?? name,
    enum: prop.enum as string[] | undefined,
  }));

  return {
    description: rb.description ?? 'Request body',
    required: rb.required ?? false,
    contentType,
    schema: schema as Record<string, unknown>,
    fields,
  };
}

/** Returns 'sse' when any 2xx response declares a text/event-stream content type. */
function detectStreaming(
  rawResponses: OpenAPIV3.ResponsesObject
): 'sse' | undefined {
  for (const [code, response] of Object.entries(rawResponses)) {
    if (!code.startsWith('2') && code !== 'default') continue;
    const r = response as OpenAPIV3.ResponseObject;
    if (r.content && 'text/event-stream' in r.content) return 'sse';
  }
  return undefined;
}

function buildOptions(parameters: Parameter[], requestBody?: RequestBody): Option[] {
  const options: Option[] = parameters.map((p) => ({
    name: _.kebabCase(p.name),
    description: `[${p.in}] (${p.schema.type}) ${p.description}`,
    required: p.required,
    type: oasTypeToTS(p.schema.type),
    defaultValue: p.schema.default as Option['defaultValue'],
    enum: p.schema.enum,
  }));

  if (requestBody) {
    if (requestBody.fields.length > 0) {
      // Generate one flag per body field for ergonomic UX
      for (const f of requestBody.fields) {
        options.push({
          name: _.kebabCase(f.name),
          description: `[body] (${f.type}) ${f.description}${f.enum ? ` (choices: ${f.enum.join('|')})` : ''}`,
          required: f.required && requestBody.required,
          type: oasTypeToTS(f.type),
          enum: f.enum,
        });
      }
      // Always provide --data as an optional raw-JSON override
      options.push({
        name: 'data',
        description: 'Override entire request body (JSON string or @filename)',
        required: false,
        type: 'string',
      });
    } else {
      // No schema fields known — fall back to raw --data
      options.push({
        name: 'data',
        description: `${requestBody.description} (JSON string or @filename)`,
        required: requestBody.required,
        type: 'string',
      });
    }
  }

  return options;
}

function oasTypeToTS(oasType: string): Option['type'] {
  if (oasType === 'integer' || oasType === 'number') return 'number';
  if (oasType === 'boolean') return 'boolean';
  return 'string';
}

function buildResponses(
  rawResponses: OpenAPIV3.ResponsesObject
): Record<string, APIResponse> {
  const result: Record<string, APIResponse> = {};
  for (const [code, response] of Object.entries(rawResponses)) {
    const r = response as OpenAPIV3.ResponseObject;
    const contentType = r.content ? Object.keys(r.content)[0] : undefined;

    let fields: ResponseField[] = [];
    if (contentType) {
      const schema = r.content?.[contentType]?.schema as OpenAPIV3.SchemaObject | undefined;
      if (schema) {
        const target: OpenAPIV3.SchemaObject =
          schema.type === 'array' ? ((schema.items as OpenAPIV3.SchemaObject) ?? {}) : schema;
        const properties = (target.properties ?? {}) as Record<string, OpenAPIV3.SchemaObject>;
        fields = Object.entries(properties).map(([name, prop]) => ({
          name,
          type: prop.type ?? 'string',
          description: prop.description ?? name,
        }));
      }
    }

    result[code] = {
      statusCode: code,
      description: r.description,
      contentType,
      fields,
      isArray: contentType
        ? (r.content?.[contentType]?.schema as OpenAPIV3.SchemaObject | undefined)?.type === 'array'
        : false,
    };
  }
  return result;
}

function extractBaseUrl(api: OpenAPIV3.Document): string {
  const server = api.servers?.[0];
  if (!server) return 'http://localhost';
  return server.url;
}

function buildGlobalOptions(): Option[] {
  return [
    {
      name: 'endpoint',
      description: 'Override the base API URL',
      required: false,
      type: 'string',
    },
    {
      name: 'format',
      description: 'Output format',
      required: false,
      type: 'string',
      defaultValue: 'json',
      enum: ['json', 'yaml', 'table'],
    },
    {
      name: 'query',
      description: 'JMESPath expression to filter the response',
      required: false,
      type: 'string',
    },
    {
      name: 'all-pages',
      description: 'Auto-follow Link rel="next" headers to collect all pages',
      required: false,
      type: 'boolean',
    },
    {
      name: 'verbose',
      description: 'Enable verbose request/response logging',
      required: false,
      type: 'boolean',
    },
  ];
}
