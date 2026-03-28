/**
 * Tests for the introspect command registration.
 */
import { describe, it, expect } from 'vitest'
import { registerIntrospect } from '../src/commands/introspect.js'

describe('introspect', () => {
  it('exports registerIntrospect as a function', () => {
    expect(typeof registerIntrospect).toBe('function')
  })
})
