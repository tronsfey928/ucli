import { describe, it, expect, vi } from 'vitest'

// Mock process.exit to prevent actually exiting
vi.spyOn(process, 'exit').mockImplementation((() => {}) as never)

describe('doctor command', () => {
  it('registerDoctor exports a function', async () => {
    const { registerDoctor } = await import('../src/commands/doctor.js')
    expect(typeof registerDoctor).toBe('function')
  })
})
