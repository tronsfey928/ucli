import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setDebugMode, isDebugMode, debug } from '../src/lib/errors.js'

describe('errors', () => {
  let stderrSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    setDebugMode(false)
    stderrSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    stderrSpy.mockRestore()
    setDebugMode(false)
  })

  it('debug mode is off by default', () => {
    expect(isDebugMode()).toBe(false)
  })

  it('setDebugMode enables debug mode', () => {
    setDebugMode(true)
    expect(isDebugMode()).toBe(true)
  })

  it('debug() does nothing when debug mode is off', () => {
    debug('test message')
    expect(stderrSpy).not.toHaveBeenCalled()
  })

  it('debug() logs when debug mode is on', () => {
    setDebugMode(true)
    debug('test message')
    expect(stderrSpy).toHaveBeenCalledWith('[DEBUG] test message')
  })
})
