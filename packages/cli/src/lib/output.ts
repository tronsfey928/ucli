/**
 * Structured output module for AI agent consumption.
 *
 * When `--output json` is active globally, every command emits a single
 * JSON envelope to stdout so that agents can reliably parse both success
 * and error results without scraping human-readable text.
 *
 * Envelope shapes:
 *   Success → { "success": true,  "data": <any> }
 *   Error   → { "success": false, "error": { "code": <number>, "message": <string>, "hint"?: <string> } }
 */

export type OutputMode = 'text' | 'json'

let currentMode: OutputMode = 'text'

/** Set the global output mode. Called once from index.ts preAction hook. */
export function setOutputMode(mode: OutputMode): void {
  currentMode = mode
}

/** Get the current output mode. */
export function getOutputMode(): OutputMode {
  return currentMode
}

/** Returns true when structured JSON output is active. */
export function isJsonOutput(): boolean {
  return currentMode === 'json'
}

/**
 * Emit a successful result.
 *
 * In JSON mode the data is wrapped in `{ success: true, data }`.
 * In text mode this is a no-op — the caller is responsible for
 * printing human-readable output itself.
 */
export function outputSuccess(data: unknown): void {
  if (currentMode === 'json') {
    console.log(JSON.stringify({ success: true, data }, null, 2))
  }
}

/**
 * Emit a structured error and exit.
 *
 * In JSON mode the error is wrapped in `{ success: false, error: { code, message, hint? } }`.
 * In text mode falls through to the existing `formatError` path.
 */
export function outputError(
  code: number,
  message: string,
  hint?: string,
): never {
  if (currentMode === 'json') {
    const envelope: Record<string, unknown> = {
      success: false,
      error: { code, message, ...(hint ? { hint } : {}) },
    }
    console.log(JSON.stringify(envelope, null, 2))
    process.exit(code)
  }

  // Text mode — re-use existing stderr formatting
  console.error(`\n✖ Error: ${message}`)
  if (hint) console.error(`  Hint: ${hint}`)
  process.exit(code)
}
