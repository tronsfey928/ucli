/**
 * Consistent error formatting utility.
 *
 * Provides a unified error output with actionable hints so that both
 * humans and AI agents can quickly understand what went wrong and how
 * to fix it.
 *
 * When `--output json` is active, errors are emitted as structured JSON
 * to stdout (via outputError) so that agents can parse them reliably.
 */
import { ExitCode, type ExitCodeValue } from './exit-codes.js'
import { isJsonOutput, outputError } from './output.js'

let debugEnabled = false

export function setDebugMode(enabled: boolean): void {
  debugEnabled = enabled
}

export function isDebugMode(): boolean {
  return debugEnabled
}

/** Log a debug message (only when --debug is active). */
export function debug(message: string): void {
  if (debugEnabled) {
    console.error(`[DEBUG] ${message}`)
  }
}

export interface FormattedError {
  code: ExitCodeValue
  message: string
  hint?: string
}

export const HINT_MAP: Record<number, string> = {
  [ExitCode.CONFIG_ERROR]:
    'Run: ucli configure --server <url> --token <jwt>',
  [ExitCode.AUTH_ERROR]:
    'Your token may be expired or revoked. Run: ucli configure --server <url> --token <jwt>',
  [ExitCode.CONNECTIVITY_ERROR]:
    'Check that the server URL is correct and the server is running. Run: ucli doctor',
  [ExitCode.NOT_FOUND]:
    'Check the resource name. Run: ucli listoas  or  ucli listmcp',
  [ExitCode.SERVER_ERROR]:
    'The server returned an unexpected error. Try again or run: ucli doctor',
}

/**
 * Print a formatted error to stderr and exit with the given code.
 *
 * When `--output json` is active, emits structured JSON to stdout
 * instead of human-readable text to stderr.
 * When --debug is active, the full stack trace is also printed (text mode only).
 */
export function formatError(err: unknown, code?: ExitCodeValue): never {
  const exitCode = code ?? classifyError(err)
  const message = err instanceof Error ? err.message : String(err)
  const hint = HINT_MAP[exitCode]

  // In JSON output mode, delegate to the structured envelope emitter
  if (isJsonOutput()) {
    outputError(exitCode, message, hint)
  }

  console.error(`\n✖ Error: ${message}`)
  if (hint) {
    console.error(`  Hint: ${hint}`)
  }

  if (debugEnabled && err instanceof Error && err.stack) {
    console.error(`\n${err.stack}`)
  }

  process.exit(exitCode)
}

/** Classify an error into an exit code based on common patterns. */
export function classifyError(err: unknown): ExitCodeValue {
  if (!(err instanceof Error)) return ExitCode.GENERAL_ERROR

  const msg = err.message.toLowerCase()

  if (msg.includes('not configured') || msg.includes('missing')) {
    return ExitCode.CONFIG_ERROR
  }
  if (msg.includes('401') || msg.includes('unauthorized') || msg.includes('authentication')) {
    return ExitCode.AUTH_ERROR
  }
  if (msg.includes('econnrefused') || msg.includes('enotfound') || msg.includes('timeout') || msg.includes('network')) {
    return ExitCode.CONNECTIVITY_ERROR
  }
  if (msg.includes('404') || msg.includes('not found')) {
    return ExitCode.NOT_FOUND
  }
  if (msg.includes('5') && msg.includes('server error')) {
    return ExitCode.SERVER_ERROR
  }

  return ExitCode.GENERAL_ERROR
}
