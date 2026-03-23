export interface AuthConfig {
  serverUrl: string
  adminSecret: string
}

const KEY = 'ucli-admin-auth'

export function getAuth(): AuthConfig | null {
  try {
    const stored = sessionStorage.getItem(KEY)
    if (!stored) return null
    return JSON.parse(stored) as AuthConfig
  } catch {
    return null
  }
}

export function setAuth(config: AuthConfig): void {
  sessionStorage.setItem(KEY, JSON.stringify(config))
}

export function clearAuth(): void {
  sessionStorage.removeItem(KEY)
}
