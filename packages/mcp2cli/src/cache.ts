import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { CacheEntry, McpServerConfig, ToolDefinition } from './types/index';

function getCacheDir(): string {
  return path.join(os.homedir(), '.mcp2cli', 'cache');
}

function getCacheKey(config: McpServerConfig): string {
  const parts: string[] = [];
  if (config.type === 'http' || config.type === 'sse') {
    parts.push(config.type + ':' + config.url);
    if (config.headers && Object.keys(config.headers).length > 0) {
      // Sort keys for deterministic hashing
      const sorted = Object.keys(config.headers).sort();
      for (const k of sorted) {
        parts.push(`${k}=${config.headers[k]}`);
      }
    }
  } else {
    parts.push(config.command);
    if (config.env && Object.keys(config.env).length > 0) {
      const sorted = Object.keys(config.env).sort();
      for (const k of sorted) {
        parts.push(`${k}=${config.env[k]}`);
      }
    }
  }
  return crypto.createHash('sha256').update(parts.join('\0')).digest('hex');
}

function getCachePath(config: McpServerConfig): string {
  return path.join(getCacheDir(), `${getCacheKey(config)}.json`);
}

export async function getCachedTools(
  config: McpServerConfig,
  ttl: number
): Promise<ToolDefinition[] | null> {
  const cachePath = getCachePath(config);
  try {
    const entry: CacheEntry = await fs.readJson(cachePath);
    const age = (Date.now() - entry.cachedAt) / 1000;
    if (age < ttl) {
      return entry.tools;
    }
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.warn(`Warning: could not read tool cache: ${(err as Error).message}`);
    }
  }
  return null;
}

export async function setCachedTools(
  config: McpServerConfig,
  tools: ToolDefinition[],
  ttl: number
): Promise<void> {
  await fs.ensureDir(getCacheDir());
  const entry: CacheEntry = { tools, cachedAt: Date.now(), ttl };
  await fs.writeJson(getCachePath(config), entry, { spaces: 2 });
}

export async function invalidateCache(config: McpServerConfig): Promise<void> {
  const cachePath = getCachePath(config);
  try {
    await fs.remove(cachePath);
  } catch {
    // ignore if not exists
  }
}
