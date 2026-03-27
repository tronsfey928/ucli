import { describe, it, expect } from 'vitest'
import { ExitCode } from '../src/lib/exit-codes.js'

describe('exit-codes', () => {
  it('exports all expected exit code constants', () => {
    expect(ExitCode.SUCCESS).toBe(0)
    expect(ExitCode.GENERAL_ERROR).toBe(1)
    expect(ExitCode.USAGE_ERROR).toBe(2)
    expect(ExitCode.CONFIG_ERROR).toBe(3)
    expect(ExitCode.AUTH_ERROR).toBe(4)
    expect(ExitCode.CONNECTIVITY_ERROR).toBe(5)
    expect(ExitCode.NOT_FOUND).toBe(6)
    expect(ExitCode.SERVER_ERROR).toBe(7)
  })

  it('has unique values for all exit codes', () => {
    const values = Object.values(ExitCode)
    expect(new Set(values).size).toBe(values.length)
  })
})
