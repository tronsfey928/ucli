import axios, { type AxiosInstance } from 'axios'
import { getAuth, clearAuth } from './auth'

// ── Types mirrored from server domain model ──────────────────────────────

export interface Group {
  id: string
  name: string
  description: string
  createdAt: string
  updatedAt: string
}

export type AuthType = 'bearer' | 'api_key' | 'basic' | 'oauth2_cc' | 'none'

export interface OASEntry {
  id: string
  groupId: string
  name: string
  description: string
  remoteUrl: string
  baseEndpoint: string | null
  authType: AuthType
  authConfig: Record<string, unknown>
  cacheTtl: number
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export interface Token {
  id: string
  groupId: string
  name: string
  scopes: string[]
  expiresAt: string | null
  revokedAt: string | null
  createdAt: string
}

export interface IssueTokenResult {
  token: Token
  jwt: string
}

// ── Error helper ──────────────────────────────────────────────────────────

export function getErrorMessage(err: unknown, fallback = 'An unexpected error occurred'): string {
  const axiosErr = err as { response?: { data?: { message?: string | string[] } } }
  const msg = axiosErr?.response?.data?.message
  if (Array.isArray(msg)) return msg.join('; ')
  return msg ?? fallback
}

// ── API client factory ────────────────────────────────────────────────────

function client(): AxiosInstance {
  const auth = getAuth()
  if (!auth) throw new Error('Not authenticated')
  const instance = axios.create({
    baseURL: auth.serverUrl,
    timeout: 30000,
    headers: {
      'X-Admin-Secret': auth.adminSecret,
      'Content-Type': 'application/json',
    },
  })
  // Auto-logout on 401 (e.g. admin secret was changed on the server)
  instance.interceptors.response.use(
    res => res,
    (err: unknown) => {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 401) {
        clearAuth()
        window.location.href = '/admin-ui/'
      }
      return Promise.reject(err)
    },
  )
  return instance
}

// Verify connectivity — used at login time
export async function ping(serverUrl: string, adminSecret: string): Promise<void> {
  await axios.get(`${serverUrl}/api/v1/health`)
  // Verify secret by listing groups (returns 401 on wrong secret)
  await axios.get(`${serverUrl}/admin/groups`, {
    headers: { 'X-Admin-Secret': adminSecret },
  })
}

// ── Groups ────────────────────────────────────────────────────────────────

export async function listGroups(): Promise<Group[]> {
  const res = await client().get<Group[]>('/admin/groups')
  return res.data
}

export async function createGroup(data: { name: string; description?: string }): Promise<Group> {
  const res = await client().post<Group>('/admin/groups', data)
  return res.data
}

export async function deleteGroup(id: string): Promise<void> {
  await client().delete(`/admin/groups/${id}`)
}

// ── Tokens ────────────────────────────────────────────────────────────────

export async function listTokens(groupId: string): Promise<Token[]> {
  const res = await client().get<Token[]>(`/admin/groups/${groupId}/tokens`)
  return res.data
}

export async function issueToken(
  groupId: string,
  data: { name: string; ttlSec?: number },
): Promise<IssueTokenResult> {
  const res = await client().post<IssueTokenResult>(`/admin/groups/${groupId}/tokens`, data)
  return res.data
}

export async function revokeToken(tokenId: string): Promise<void> {
  await client().delete(`/admin/tokens/${tokenId}`)
}

// ── OAS entries ───────────────────────────────────────────────────────────

export async function listOAS(): Promise<OASEntry[]> {
  const res = await client().get<OASEntry[]>('/admin/oas')
  return res.data
}

export async function createOAS(data: {
  groupId: string
  name: string
  description?: string
  remoteUrl: string
  baseEndpoint?: string
  authType: AuthType
  authConfig: Record<string, unknown>
  cacheTtl?: number
}): Promise<OASEntry> {
  const res = await client().post<OASEntry>('/admin/oas', data)
  return res.data
}

export async function updateOAS(
  id: string,
  data: Partial<{
    name: string
    description: string
    remoteUrl: string
    baseEndpoint: string
    authType: AuthType
    authConfig: Record<string, unknown>
    cacheTtl: number
    enabled: boolean
  }>,
): Promise<OASEntry> {
  const res = await client().put<OASEntry>(`/admin/oas/${id}`, data)
  return res.data
}

export async function deleteOAS(id: string): Promise<void> {
  await client().delete(`/admin/oas/${id}`)
}

// ── Stats helper ──────────────────────────────────────────────────────────

export interface Stats {
  groups: number
  oasEntries: number
  activeTokens: number
}

export async function getStats(): Promise<Stats> {
  const [groups, oas] = await Promise.all([listGroups(), listOAS()])
  // Approximate active token count from all groups
  const tokenCounts = await Promise.all(
    groups.map(g => listTokens(g.id).then(ts => ts.filter(t => !t.revokedAt).length).catch(() => 0)),
  )
  return {
    groups: groups.length,
    oasEntries: oas.length,
    activeTokens: tokenCounts.reduce((a, b) => a + b, 0),
  }
}
