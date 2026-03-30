/**
 * OAS Spec Caching — src/cache.ts
 *
 * Wraps parseOAS() with a disk-based cache in ~/.cache/openapi2cli/.
 * Only remote URLs are cached (local files are cheap to read directly).
 * Cache keys are SHA-256 hashes of the input URL.
 * TTL: configurable, default 3600 seconds (1 hour).
 */

import * as crypto from 'crypto';
import * as os from 'os';
import * as path from 'path';
import * as fse from 'fs-extra';
import { OpenAPIV3 } from 'openapi-types';
import { parseOAS } from './parser/oas-parser';

const CACHE_DIR = path.join(os.homedir(), '.cache', 'openapi2cli');
const DEFAULT_TTL_MS = 3_600_000; // 1 hour

function cacheKey(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function cacheFile(input: string): string {
  return path.join(CACHE_DIR, `${cacheKey(input)}.json`);
}

/**
 * Parse an OpenAPI spec with optional disk caching.
 *
 * - Local file paths:  always calls parseOAS() directly (never cached).
 * - Remote URLs:       checks ~/.cache/openapi2cli/<sha256>.json first;
 *                      re-fetches if the file is older than ttlMs or noCache is true.
 */
export async function parseOASWithCache(
  input: string,
  opts: { noCache?: boolean; ttlMs?: number } = {},
): Promise<OpenAPIV3.Document> {
  const trimmed = input.trim();
  const isUrl = /^https?:\/\//.test(trimmed);

  // Local files: skip cache entirely
  if (!isUrl) return parseOAS(trimmed);

  const ttl = opts.ttlMs ?? DEFAULT_TTL_MS;
  const file = cacheFile(trimmed);

  if (!opts.noCache) {
    try {
      const stat = await fse.stat(file);
      if (Date.now() - stat.mtimeMs < ttl) {
        const cached = await fse.readJSON(file);
        // Validate basic OAS 3.x structure before trusting the cache
        if (
          typeof cached?.openapi === 'string' && cached.openapi.startsWith('3.') &&
          typeof cached?.info === 'object' && cached.info !== null &&
          typeof cached?.paths === 'object' && cached.paths !== null
        ) {
          return cached as OpenAPIV3.Document;
        }
        // Invalid cache entry — fall through to re-fetch
      }
    } catch {
      // File does not exist or is unreadable — proceed to fetch
    }
  }

  const doc = await parseOAS(trimmed);
  try {
    await fse.ensureDir(CACHE_DIR);
    await fse.writeJSON(file, doc);
  } catch {
    // Cache write failure is non-fatal — proceed with the parsed doc
  }
  return doc;
}

/** Remove all cached specs (useful for `--no-cache` debug workflows). */
export async function clearCache(): Promise<void> {
  await fse.emptyDir(CACHE_DIR);
}
