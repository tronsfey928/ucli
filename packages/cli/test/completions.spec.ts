import { describe, it, expect, vi } from 'vitest'

// Mock process.exit to prevent actually exiting
vi.spyOn(process, 'exit').mockImplementation((() => {}) as never)

describe('completions command', () => {
  it('registerCompletions exports a function', async () => {
    const { registerCompletions } = await import('../src/commands/completions.js')
    expect(typeof registerCompletions).toBe('function')
  })
})
