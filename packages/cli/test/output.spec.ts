/**
 * Tests for the structured output module (output.ts).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { setOutputMode, getOutputMode, isJsonOutput } from '../src/lib/output.js'

describe('output', () => {
  beforeEach(() => {
    setOutputMode('text')
  })

  it('defaults to text mode', () => {
    expect(getOutputMode()).toBe('text')
    expect(isJsonOutput()).toBe(false)
  })

  it('can be set to json mode', () => {
    setOutputMode('json')
    expect(getOutputMode()).toBe('json')
    expect(isJsonOutput()).toBe(true)
  })

  it('can be switched back to text mode', () => {
    setOutputMode('json')
    setOutputMode('text')
    expect(getOutputMode()).toBe('text')
    expect(isJsonOutput()).toBe(false)
  })
})
