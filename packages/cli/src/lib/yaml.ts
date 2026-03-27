/**
 * YAML output format support.
 *
 * A lightweight YAML serialiser that covers the data shapes produced by
 * ucli commands (plain objects, arrays, strings, numbers, booleans, null).
 * No external dependencies — we don't need a full YAML parser, only output.
 */

/** Convert a JSON-serialisable value to a YAML string. */
export function toYaml(value: unknown, indent = 0): string {
  if (value === null || value === undefined) {
    return 'null'
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false'
  }

  if (typeof value === 'number') {
    return String(value)
  }

  if (typeof value === 'string') {
    // Use quotes if the string contains special YAML characters
    if (needsQuoting(value)) {
      return JSON.stringify(value)
    }
    return value
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]'
    const prefix = ' '.repeat(indent)
    return value
      .map((item) => {
        const serialised = toYaml(item, indent + 2)
        if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
          // Object items: put the first key on the same line as the dash
          const firstNewline = serialised.indexOf('\n')
          if (firstNewline === -1) {
            return `${prefix}- ${serialised}`
          }
          const firstLine = serialised.slice(0, firstNewline)
          const rest = serialised.slice(firstNewline + 1)
          return `${prefix}- ${firstLine.trimStart()}\n${rest}`
        }
        return `${prefix}- ${serialised}`
      })
      .join('\n')
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
    if (entries.length === 0) return '{}'
    const prefix = ' '.repeat(indent)
    return entries
      .map(([key, val]) => {
        if (val === null || val === undefined) {
          return `${prefix}${key}: null`
        }
        if (typeof val === 'object') {
          const nested = toYaml(val, indent + 2)
          return `${prefix}${key}:\n${nested}`
        }
        return `${prefix}${key}: ${toYaml(val, indent)}`
      })
      .join('\n')
  }

  return String(value)
}

function needsQuoting(s: string): boolean {
  if (s === '') return true
  if (s === 'true' || s === 'false' || s === 'null') return true
  if (/^\d/.test(s)) return true
  if (/[:{}\[\],&*#?|<>=!%@`'"\\\n\r\t]/.test(s)) return true
  if (s.startsWith(' ') || s.endsWith(' ')) return true
  return false
}
