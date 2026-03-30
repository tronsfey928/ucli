/**
 * Structured logger for openapi2cli.
 *
 * Replaces scattered `console.log` / `console.error` + chalk calls with a
 * centralised, level-aware logger.  Levels: debug, info, warn, error.
 *
 * All output goes to stderr (the proper channel for diagnostic messages)
 * except `info`, which goes to stdout for piping-friendly behaviour.
 */

import chalk from 'chalk';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
};

export interface Logger {
  debug(msg: string, ...args: unknown[]): void;
  info(msg: string, ...args: unknown[]): void;
  warn(msg: string, ...args: unknown[]): void;
  error(msg: string, ...args: unknown[]): void;
}

let currentLevel: LogLevel = 'info';

export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

export function getLogLevel(): LogLevel {
  return currentLevel;
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[currentLevel];
}

/**
 * Default logger implementation.
 *
 * - `debug` → stderr with dim prefix
 * - `info`  → stdout (clean, pipe-friendly)
 * - `warn`  → stderr with yellow ⚠ prefix
 * - `error` → stderr with red ✗ prefix
 */
export const logger: Logger = {
  debug(msg: string, ...args: unknown[]) {
    if (!shouldLog('debug')) return;
    console.error(chalk.dim('[debug]'), msg, ...args);
  },

  info(msg: string, ...args: unknown[]) {
    if (!shouldLog('info')) return;
    console.log(msg, ...args);
  },

  warn(msg: string, ...args: unknown[]) {
    if (!shouldLog('warn')) return;
    console.error(chalk.yellow('⚠'), msg, ...args);
  },

  error(msg: string, ...args: unknown[]) {
    if (!shouldLog('error')) return;
    console.error(chalk.red('✗'), msg, ...args);
  },
};
