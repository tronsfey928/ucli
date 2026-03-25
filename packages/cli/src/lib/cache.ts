/**
 * Local file cache for OAS entries.
 * Stored at ~/.cache/oas-cli/<name>.json with TTL metadata.
 *
 * Security: authConfig credential values are stripped before writing.
 * Only { type } is persisted — full secrets are never written to disk.
 */
import { readFile, writeFile, mkdir, chmod } from 'node:fs/promises'
import { join } from 'node:path'
import { cacheDir } from '../config.js'
import type { OASEntryPublic } from './server-client.js'

interface CacheFile {
  entries: OASEntryPublic[]
  fetchedAt: number  // ms timestamp
  ttlSec: number     // cache duration
}

const LIST_CACHE_FILE = join(cacheDir, 'oas-list.json')

async function ensureCacheDir(): Promise<void> {
  await mkdir(cacheDir, { recursive: true, mode: 0o700 })
}

/** Strip credential secrets from authConfig — only persist { type }. */
function redactEntries(entries: OASEntryPublic[]): OASEntryPublic[] {
  return entries.map((e) => ({
    ...e,
    authConfig: { type: (e.authConfig as Record<string, unknown>)['type'] ?? 'none' },
  }))
}

export async function readOASListCache(): Promise<OASEntryPublic[] | null> {
  try {
    const raw = await readFile(LIST_CACHE_FILE, 'utf8')
    const cached: CacheFile = JSON.parse(raw)
    const age = (Date.now() - cached.fetchedAt) / 1000
    if (cached.ttlSec === 0 || age > cached.ttlSec) return null  // expired
    return cached.entries
  } catch {
    return null  // not found or parse error
  }
}

export async function writeOASListCache(entries: OASEntryPublic[], ttlSec: number): Promise<void> {
  await ensureCacheDir()
  const cached: CacheFile = { entries: redactEntries(entries), fetchedAt: Date.now(), ttlSec }
  await writeFile(LIST_CACHE_FILE, JSON.stringify(cached, null, 2), { encoding: 'utf8', mode: 0o600 })
}

export async function clearOASListCache(): Promise<void> {
  try {
    await writeFile(LIST_CACHE_FILE, '{}', { encoding: 'utf8', mode: 0o600 })
  } catch {
    // ignore if not found
  }
}

export async function clearOASCache(name: string): Promise<void> {
  try {
    const raw = await readFile(LIST_CACHE_FILE, 'utf8')
    const cached: CacheFile = JSON.parse(raw)
    const entries = Array.isArray(cached.entries) ? cached.entries.filter((e) => e.name !== name) : []
    if (entries.length === 0) {
      await clearOASListCache()
      return
    }
    const next: CacheFile = {
      entries,
      fetchedAt: cached.fetchedAt ?? Date.now(),
      ttlSec: cached.ttlSec ?? 0,
    }
    await writeFile(LIST_CACHE_FILE, JSON.stringify(next, null, 2), { encoding: 'utf8', mode: 0o600 })
  } catch {
    await clearOASListCache()
  }
}
