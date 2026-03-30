export interface HttpServerConfig {
  type: 'http';
  /** HTTP/SSE server URL */
  url: string;
  /** Custom HTTP headers for the HTTP server */
  headers?: Record<string, string>;
}

export interface StdioServerConfig {
  type: 'stdio';
  /** Full command string to spawn */
  command: string;
  /** Extra environment variables for the stdio process */
  env?: Record<string, string>;
}

export type McpServerConfig = HttpServerConfig | StdioServerConfig;

export interface BakeEntry {
  name: string;
  config: McpServerConfig;
  createdAt: string;
}

export interface BakeStore {
  [name: string]: BakeEntry;
}

export interface GlobalOptions {
  mcp?: string;
  mcpStdio?: string;
  env?: string[];
  header?: string[];
  list?: boolean;
  pretty?: boolean;
  raw?: boolean;
  json?: boolean;
  jq?: string;
  describe?: string;
  inputJson?: string;
  /** Commander stores --no-cache as `cache: false` (not `noCache: true`) */
  cache?: boolean;
  cacheTtl?: string;
  debug?: boolean;
}

// ---------------------------------------------------------------------------
// Semantic exit codes — agents can distinguish error types programmatically
// ---------------------------------------------------------------------------
export const EXIT_OK = 0;
export const EXIT_GENERAL = 1;
export const EXIT_CONNECTION = 2;
export const EXIT_TOOL_NOT_FOUND = 3;
export const EXIT_INVALID_ARGS = 4;
export const EXIT_TOOL_EXECUTION = 5;

// ---------------------------------------------------------------------------
// Structured error envelope for --json mode
// ---------------------------------------------------------------------------
export interface JsonErrorEnvelope {
  ok: false;
  error: {
    code: string;
    message: string;
    suggestions?: string[];
    exitCode: number;
  };
}

export interface JsonSuccessEnvelope<T = unknown> {
  ok: true;
  result: T;
}

export interface ToolParam {
  /** Original property name from the JSON Schema (may be camelCase) */
  name: string;
  /** Kebab-cased CLI flag name without leading dashes */
  cliFlag: string;
  type: 'string' | 'number' | 'boolean' | 'array';
  /** Element type for array parameters */
  itemsType?: 'string' | 'number' | 'boolean';
  description: string;
  required: boolean;
  defaultValue?: unknown;
  enumValues?: string[];
}

export interface CacheEntry {
  tools: ToolDefinition[];
  cachedAt: number;
  ttl: number;
}

export interface ToolDefinition {
  name: string;
  description?: string;
  inputSchema: {
    type: string;
    properties?: Record<string, JsonSchemaProperty>;
    required?: string[];
  };
}

export interface JsonSchemaProperty {
  type?: string | string[];
  description?: string;
  default?: unknown;
  enum?: string[];
  items?: JsonSchemaProperty;
}
