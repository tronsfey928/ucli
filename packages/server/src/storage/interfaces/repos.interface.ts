// ── Domain models ──────────────────────────────────────────────────────────

export interface Group {
  id: string
  name: string
  description: string
  createdAt: Date
  updatedAt: Date
}

export interface Token {
  id: string
  groupId: string
  name: string
  jti: string
  scopes: string[]
  expiresAt: Date | null
  revokedAt: Date | null
  createdAt: Date
}

export type AuthType = 'bearer' | 'api_key' | 'basic' | 'oauth2_cc' | 'none'

export type AuthConfig =
  | { type: 'bearer'; token: string }
  | { type: 'api_key'; key: string; in: 'header' | 'query'; name: string }
  | { type: 'basic'; username: string; password: string }
  | { type: 'oauth2_cc'; tokenUrl: string; clientId: string; clientSecret: string; scopes: string[] }
  | { type: 'none' }

export interface OASEntry {
  id: string
  groupId: string
  name: string
  description: string
  remoteUrl: string
  baseEndpoint: string | null
  authType: AuthType
  /** Stored AES-256-GCM encrypted; decrypted on retrieval */
  authConfig: AuthConfig
  cacheTtl: number
  enabled: boolean
  createdAt: Date
  updatedAt: Date
}

// ── Input types ────────────────────────────────────────────────────────────

export interface CreateGroupInput {
  name: string
  description: string
}

export interface CreateTokenInput {
  groupId: string
  name: string
  jti: string
  scopes: string[]
  expiresAt: Date | null
}

export interface CreateOASInput {
  groupId: string
  name: string
  description: string
  remoteUrl: string
  baseEndpoint?: string | null
  authType: AuthType
  authConfig: AuthConfig
  cacheTtl?: number
}

export interface UpdateOASInput {
  name?: string
  description?: string
  remoteUrl?: string
  baseEndpoint?: string | null
  authType?: AuthType
  authConfig?: AuthConfig
  cacheTtl?: number
  enabled?: boolean
}

// ── Repository interfaces ──────────────────────────────────────────────────

export interface IGroupRepo {
  create(data: CreateGroupInput): Promise<Group>
  findAll(): Promise<Group[]>
  findById(id: string): Promise<Group | null>
  findByName(name: string): Promise<Group | null>
}

export interface ITokenRepo {
  create(data: CreateTokenInput): Promise<Token>
  findById(id: string): Promise<Token | null>
  findByJti(jti: string): Promise<Token | null>
  findByGroup(groupId: string): Promise<Token[]>
  revoke(id: string, revokedAt: Date): Promise<void>
}

export interface IOASRepo {
  create(data: CreateOASInput): Promise<OASEntry>
  findAll(): Promise<OASEntry[]>
  findByGroup(groupId: string): Promise<OASEntry[]>
  findById(id: string): Promise<OASEntry | null>
  findByName(name: string, groupId?: string): Promise<OASEntry | null>
  update(id: string, data: UpdateOASInput): Promise<OASEntry>
  delete(id: string): Promise<void>
}

// ── MCP domain models ───────────────────────────────────────────────────────

export type McpAuthConfig =
  | { type: 'none' }
  | { type: 'http_headers'; headers: Record<string, string> }
  | { type: 'env'; env: Record<string, string> }

export interface McpEntry {
  id: string
  groupId: string
  name: string
  description: string
  transport: 'http' | 'sse' | 'stdio'
  serverUrl: string | null
  command: string | null
  /** Stored AES-256-GCM encrypted; decrypted on retrieval */
  authConfig: McpAuthConfig
  enabled: boolean
  createdAt: Date
  updatedAt: Date
}

export interface CreateMcpInput {
  groupId: string
  name: string
  description: string
  transport: 'http' | 'sse' | 'stdio'
  serverUrl?: string | null
  command?: string | null
  authConfig: McpAuthConfig
}

export interface UpdateMcpInput {
  name?: string
  description?: string
  transport?: 'http' | 'sse' | 'stdio'
  serverUrl?: string | null
  command?: string | null
  authConfig?: McpAuthConfig
  enabled?: boolean
}

export interface IMCPRepo {
  create(data: CreateMcpInput): Promise<McpEntry>
  findAll(): Promise<McpEntry[]>
  findByGroup(groupId: string): Promise<McpEntry[]>
  findById(id: string): Promise<McpEntry | null>
  findByName(name: string, groupId?: string): Promise<McpEntry | null>
  update(id: string, data: UpdateMcpInput): Promise<McpEntry>
  delete(id: string): Promise<void>
}
