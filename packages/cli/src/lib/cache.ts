/**
 * Local file cache for OAS entries.
 * Stored at ~/.cache/oas-cli/<name>.json with TTL metadata.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
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
  await mkdir(cacheDir, { recursive: true })
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
  const cached: CacheFile = { entries, fetchedAt: Date.now(), ttlSec }
  await writeFile(LIST_CACHE_FILE, JSON.stringify(cached, null, 2), 'utf8')
}

export async function clearOASListCache(): Promise<void> {
  try {
    await writeFile(LIST_CACHE_FILE, '{}', 'utf8')
  } catch {
    // ignore if not found
  }
}
