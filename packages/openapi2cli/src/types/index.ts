export type HTTPMethod = 'get' | 'post' | 'put' | 'patch' | 'delete' | 'head' | 'options';

export interface CLIConfig {
  oas: string;     // file path or URL to OAS document
  name: string;    // name of the generated CLI
  output: string;  // directory to write the generated project into
}

export interface Option {
  name: string;          // kebab-case CLI flag name: e.g. "user-id"
  alias?: string;        // single-char alias: e.g. "u"
  description: string;
  required: boolean;
  type: 'string' | 'number' | 'boolean';
  defaultValue?: string | number | boolean;
  enum?: string[];       // if present, generate Commander .choices()
}

export interface Parameter {
  name: string;
  in: 'query' | 'path' | 'header' | 'cookie';
  description: string;
  required: boolean;
  schema: {
    type: string;
    enum?: string[];
    default?: unknown;
  };
}

export interface RequestBodyField {
  name: string;       // original JSON field name (used as body key)
  optKey: string;     // Commander opts key = camelCase(kebabCase(name))
  type: string;
  required: boolean;
  description: string;
  enum?: string[];
}

export interface ResponseField {
  name: string;
  type: string;
  description: string;
}

export interface RequestBody {
  description: string;
  required: boolean;
  contentType: string;
  schema: Record<string, unknown>;
  fields: RequestBodyField[];
}

export interface APIResponse {
  statusCode: string;
  description: string;
  contentType?: string;
  fields: ResponseField[];
  isArray: boolean;   // true when the response schema is type: array
}

export interface SubCommand {
  name: string;                // kebab-case operation name
  description: string;
  method: HTTPMethod;
  path: string;                // original OAS path: "/users/{userId}"
  parameters: Parameter[];
  requestBody?: RequestBody;
  responses: Record<string, APIResponse>;
  options: Option[];           // derived from parameters + requestBody
  securitySchemes: string[];   // names of applicable security scheme keys
  aliases: string[];           // from x-cli-aliases OpenAPI extension
  streaming?: 'sse';           // set when a 2xx response uses text/event-stream
}

export interface CommandGroup {
  name: string;                // kebab-case tag name
  description: string;
  subcommands: SubCommand[];
}

/** Body field name → environment variable mapping for dynamic token providers. */
export interface TokenEnvVar {
  name: string;  // JSON body field name sent to the token endpoint
  env: string;   // environment variable that supplies the value
}

export type AuthType =
  | 'bearer'          // static bearer token from env var
  | 'apiKey'          // API key header/query param from env var
  | 'basic'           // HTTP Basic credentials from env var
  | 'oauth2-cc'       // OAuth2 client credentials: exchange client_id+secret for token
  | 'dynamic'         // custom token endpoint: call URL with env-var-supplied body fields
  | 'none';

export interface AuthConfig {
  type: AuthType;
  envVar: string;              // main env var: token (bearer/apiKey/basic), unused for oauth2-cc/dynamic
  headerName?: string;         // for apiKey: the HTTP header or query param name
  tokenUrl?: string;           // for oauth2-cc: RFC 6749 token endpoint; for dynamic: custom endpoint
  clientIdEnvVar?: string;     // for oauth2-cc
  clientSecretEnvVar?: string; // for oauth2-cc
  scopesEnvVar?: string;       // for oauth2-cc: optional space-separated scopes
  tokenEnvVars?: TokenEnvVar[]; // for dynamic: body fields sourced from env vars
}

export interface CommandStructure {
  name: string;
  description: string;
  version: string;
  baseUrl: string;
  groups: CommandGroup[];
  flatCommands: SubCommand[];  // operations with no tags, registered directly on program
  globalOptions: Option[];
  authConfig: AuthConfig;
  allAuthSchemes: string[];    // all scheme names for generated comments
  warnings: string[];          // non-fatal issues detected during analysis
}

export interface GeneratedFile {
  relativePath: string;  // path relative to output directory
  content: string;
}

// ─── Runtime Client Abstractions ────────────────────────────────────────────

/** Options for a single HTTP request made by the runtime client. */
export interface RequestOptions {
  method: string;
  path: string;
  pathParams: Record<string, string>;
  queryParams: Record<string, string>;
  headers?: Record<string, string>;
  body?: unknown;
  verbose?: boolean;
  allPages?: boolean;
}

/** The runtime HTTP client used by the proxy-runner and generated CLIs. */
export interface RuntimeClient {
  /** Execute a regular HTTP request (with retry & optional pagination). */
  request(options: RequestOptions): Promise<unknown>;
  /** Execute a streaming SSE request, yielding individual events. */
  requestStream(options: RequestOptions): AsyncGenerator<string, void, unknown>;
}

/**
 * Middleware function for the runtime HTTP client.
 *
 * A middleware receives the request options and a `next` function.  It can
 * modify the options, short-circuit, or post-process the result:
 *
 * ```ts
 * const loggingMiddleware: Middleware = async (opts, next) => {
 *   console.log('→', opts.method, opts.path);
 *   const result = await next(opts);
 *   console.log('←', result);
 *   return result;
 * };
 * ```
 */
export type Middleware = (
  options: RequestOptions,
  next: (options: RequestOptions) => Promise<unknown>,
) => Promise<unknown>;

// ─── Agent-Friendly Structured Output ───────────────────────────────────────

/**
 * Standard envelope for all machine-mode output.
 * When `--machine` is active, every response (success or error) is wrapped
 * in this structure so agents can parse output deterministically.
 */
export interface AgentEnvelope {
  success: boolean;
  data?: unknown;
  error?: {
    type: string;
    message: string;
    statusCode?: number;
    errorCode?: string;
    hint?: string;
    responseData?: unknown;
  };
  meta?: {
    operation?: string;
    method?: string;
    path?: string;
    baseUrl?: string;
    durationMs?: number;
  };
}

/** Summary of a single operation, used in machine-mode list output. */
export interface OperationInfo {
  name: string;
  group?: string;
  description: string;
  method: string;
  path: string;
  streaming?: string;
}

/** Full introspection of an operation, returned by `describe`. */
export interface OperationDetail extends OperationInfo {
  parameters: {
    name: string;
    in: string;
    type: string;
    required: boolean;
    description: string;
    enum?: string[];
    default?: unknown;
  }[];
  requestBody?: {
    required: boolean;
    contentType: string;
    fields: {
      name: string;
      type: string;
      required: boolean;
      description: string;
      enum?: string[];
    }[];
  };
  responses: {
    statusCode: string;
    description: string;
    contentType?: string;
    fields: { name: string; type: string; description: string }[];
    isArray: boolean;
  }[];
  authentication: string[];
  options: {
    flag: string;
    description: string;
    required: boolean;
    type: string;
    enum?: string[];
    default?: unknown;
  }[];
  exampleCommand: string;
}

/** Dry-run preview of an HTTP request that would be sent. */
export interface DryRunResult {
  method: string;
  url: string;
  headers: Record<string, string>;
  queryParams: Record<string, string>;
  body?: unknown;
}
