import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Patch cacheDir before importing the cache module
let tempDir: string

vi.mock('../src/config.js', async () => {
  const mod = await vi.importActual<typeof import('../src/config.js')>('../src/config.js')
  return {
    ...mod,
    get cacheDir() { return tempDir },
    isConfigured: () => true,
    getConfig: () => ({ serverUrl: 'http://localhost:3000', token: 'test' }),
  }
})

describe('CLI cache', () => {
  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'oas-cli-test-'))
    vi.resetModules()
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  it('returns null when cache is empty', async () => {
    const { readOASListCache } = await import('../src/lib/cache.js')
    const result = await readOASListCache()
    expect(result).toBeNull()
  })

  it('writes and reads back cached entries', async () => {
    const { readOASListCache, writeOASListCache } = await import('../src/lib/cache.js')
    const entries = [{
      id: '1', name: 'svc', description: 'test', remoteUrl: 'https://example.com',
      baseEndpoint: null, authType: 'none' as const, authConfig: { type: 'none' as const }, cacheTtl: 3600,
    }]

    await writeOASListCache(entries, 3600)
    const result = await readOASListCache()
    expect(result).not.toBeNull()
    expect(result![0]!.name).toBe('svc')
  })

  it('returns null for expired cache', async () => {
    const { readOASListCache, writeOASListCache } = await import('../src/lib/cache.js')
    const entries = [{
      id: '1', name: 'svc', description: 'test', remoteUrl: 'https://example.com',
      baseEndpoint: null, authType: 'none' as const, authConfig: { type: 'none' as const }, cacheTtl: 0,
    }]

    await writeOASListCache(entries, 0) // TTL = 0, immediately expired
    const result = await readOASListCache()
    expect(result).toBeNull()
  })

  it('strips credential secrets from cached entries (security)', async () => {
    const { readOASListCache, writeOASListCache } = await import('../src/lib/cache.js')
    const entries = [{
      id: '1', name: 'svc', description: 'test', remoteUrl: 'https://example.com',
      baseEndpoint: null, authType: 'bearer' as const,
      authConfig: { type: 'bearer' as const, token: 'super-secret-token' },
      cacheTtl: 3600,
    }]

    await writeOASListCache(entries, 3600)
    const result = await readOASListCache()
    expect(result).not.toBeNull()
    // Only { type } should be persisted, no secret values
    expect(result![0]!.authConfig).toEqual({ type: 'bearer' })
    expect((result![0]!.authConfig as Record<string, unknown>)['token']).toBeUndefined()
  })

  it('writes cache files with restrictive permissions (security)', async () => {
    const { writeOASListCache } = await import('../src/lib/cache.js')
    const { stat } = await import('node:fs/promises')
    const { join } = await import('node:path')
    const entries = [{
      id: '1', name: 'svc', description: 'test', remoteUrl: 'https://example.com',
      baseEndpoint: null, authType: 'none' as const, authConfig: { type: 'none' as const }, cacheTtl: 3600,
    }]

    await writeOASListCache(entries, 3600)
    const fileStat = await stat(join(tempDir, 'oas-list.json'))
    // File should be owner-only readable (0o600 = 33216 in decimal, mode & 0o777 = 0o600)
    const perms = fileStat.mode & 0o777
    expect(perms).toBe(0o600)
  })
})
