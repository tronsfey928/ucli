import chalk from 'chalk';
import { McpServerConfig } from './types/index';

/**
 * Build a McpServerConfig from parsed CLI options.
 */
export function buildServerConfig(opts: {
  mcp?: string;
  mcpStdio?: string;
  env?: string[];
  header?: string[];
}): McpServerConfig {
  if (opts.mcp) {
    const headers: Record<string, string> = {};
    for (const h of opts.header ?? []) {
      const idx = h.indexOf(':');
      if (idx === -1) {
        console.warn(chalk.yellow(`Warning: ignoring malformed header (missing ':'): "${h}"`));
        continue;
      }
      headers[h.slice(0, idx).trim()] = h.slice(idx + 1).trim();
    }
    return { type: 'http', url: opts.mcp, headers };
  }
  const env: Record<string, string> = {};
  for (const e of opts.env ?? []) {
    const idx = e.indexOf('=');
    if (idx === -1) {
      console.warn(chalk.yellow(`Warning: ignoring malformed env var (missing '='): "${e}"`));
      continue;
    }
    env[e.slice(0, idx)] = e.slice(idx + 1);
  }
  return { type: 'stdio', command: opts.mcpStdio!, env };
}

/**
 * Parse and validate cache TTL from user input, returning a safe default on
 * invalid values.
 */
export function resolveCacheTtl(input: unknown): number {
  const str = String(input ?? '3600');
  const parsed = Number(str);
  if (!Number.isFinite(parsed) || parsed < 0) {
    console.warn(`Warning: invalid cache TTL "${str}", using default (3600s)`);
    return 3600;
  }
  return Math.floor(parsed);
}

/**
 * Find the closest matching tool names using Levenshtein distance.
 * Returns up to `maxResults` suggestions within the given edit-distance threshold.
 */
export function suggestToolNames(
  input: string,
  available: string[],
  maxResults = 3,
  maxDistance = 3
): string[] {
  const results: { name: string; dist: number }[] = [];
  for (const name of available) {
    const dist = levenshtein(input.toLowerCase(), name.toLowerCase());
    if (dist <= maxDistance) {
      results.push({ name, dist });
    }
  }
  results.sort((a, b) => a.dist - b.dist);
  return results.slice(0, maxResults).map((r) => r.name);
}

/**
 * Compute Levenshtein edit distance between two strings.
 */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0) as number[]);

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  return dp[m][n];
}
