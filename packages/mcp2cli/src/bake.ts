import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { BakeStore, BakeEntry, McpServerConfig } from './types/index';

function getBakeFile(): string {
  return path.join(os.homedir(), '.mcp2cli', 'bakes.json');
}

async function readStore(): Promise<BakeStore> {
  try {
    return await fs.readJson(getBakeFile());
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.warn(`Warning: could not read bake store: ${(err as Error).message}`);
    }
    return {};
  }
}

async function writeStore(store: BakeStore): Promise<void> {
  const bakeFile = getBakeFile();
  await fs.ensureDir(path.dirname(bakeFile));
  // Atomic write: write to temp file then rename to prevent corruption
  const tmpFile = bakeFile + '.tmp';
  await fs.writeJson(tmpFile, store, { spaces: 2 });
  await fs.move(tmpFile, bakeFile, { overwrite: true });
}

/** Names that collide with Object.prototype properties and must be rejected. */
const RESERVED_NAMES = new Set([
  '__proto__', 'constructor', 'toString', 'valueOf', 'hasOwnProperty',
  'isPrototypeOf', 'propertyIsEnumerable', 'toLocaleString',
]);

/** Pattern for valid bake names: alphanumeric, hyphens, and underscores. */
const VALID_NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;

export async function createBake(name: string, config: McpServerConfig): Promise<void> {
  if (!name || !name.trim()) {
    throw new Error('Bake name cannot be empty');
  }
  if (RESERVED_NAMES.has(name)) {
    throw new Error(`Bake name "${name}" is reserved`);
  }
  if (!VALID_NAME_PATTERN.test(name)) {
    throw new Error(
      `Bake name "${name}" is invalid. Use only letters, digits, hyphens, and underscores (must start with a letter or digit).`
    );
  }
  const store = await readStore();
  const entry: BakeEntry = { name, config, createdAt: new Date().toISOString() };
  store[name] = entry;
  await writeStore(store);
}

export async function getBake(name: string): Promise<BakeEntry | null> {
  const store = await readStore();
  if (!Object.prototype.hasOwnProperty.call(store, name)) return null;
  return store[name] ?? null;
}

export async function listBakes(): Promise<BakeEntry[]> {
  const store = await readStore();
  return Object.values(store);
}

export async function deleteBake(name: string): Promise<boolean> {
  const store = await readStore();
  if (!Object.prototype.hasOwnProperty.call(store, name)) return false;
  delete store[name];
  await writeStore(store);
  return true;
}

/**
 * Convert a McpServerConfig back into CLI flag strings for argv injection.
 */
export function configToArgs(config: McpServerConfig): string[] {
  const args: string[] = [];
  if (config.type === 'http' || config.type === 'sse') {
    args.push('--mcp', config.url);
    if (config.headers) {
      for (const [k, v] of Object.entries(config.headers)) {
        args.push('--header', `${k}: ${v}`);
      }
    }
  } else {
    args.push('--mcp-stdio', config.command);
    if (config.env) {
      for (const [k, v] of Object.entries(config.env)) {
        args.push('--env', `${k}=${v}`);
      }
    }
  }
  return args;
}
