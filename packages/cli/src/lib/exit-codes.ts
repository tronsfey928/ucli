/**
 * Structured exit codes for automation and scripting.
 *
 * Convention:
 *   0       — success
 *   1       — general / unknown error
 *   2       — usage / argument error
 *   3       — configuration error (missing or invalid config)
 *   4       — authentication error (invalid / expired token)
 *   5       — connectivity error (server unreachable)
 *   6       — not-found error (service / resource doesn't exist)
 *   7       — server error (5xx from upstream)
 */

export const ExitCode = {
  SUCCESS: 0,
  GENERAL_ERROR: 1,
  USAGE_ERROR: 2,
  CONFIG_ERROR: 3,
  AUTH_ERROR: 4,
  CONNECTIVITY_ERROR: 5,
  NOT_FOUND: 6,
  SERVER_ERROR: 7,
} as const

export type ExitCodeValue = (typeof ExitCode)[keyof typeof ExitCode]
