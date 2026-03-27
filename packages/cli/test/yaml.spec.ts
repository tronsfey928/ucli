import { describe, it, expect } from 'vitest'
import { toYaml } from '../src/lib/yaml.js'

describe('yaml', () => {
  it('serialises null', () => {
    expect(toYaml(null)).toBe('null')
  })

  it('serialises undefined as null', () => {
    expect(toYaml(undefined)).toBe('null')
  })

  it('serialises booleans', () => {
    expect(toYaml(true)).toBe('true')
    expect(toYaml(false)).toBe('false')
  })

  it('serialises numbers', () => {
    expect(toYaml(42)).toBe('42')
    expect(toYaml(3.14)).toBe('3.14')
  })

  it('serialises simple strings without quotes', () => {
    expect(toYaml('hello')).toBe('hello')
  })

  it('quotes strings that look like numbers', () => {
    expect(toYaml('123')).toBe('"123"')
  })

  it('quotes strings that look like booleans', () => {
    expect(toYaml('true')).toBe('"true"')
    expect(toYaml('false')).toBe('"false"')
  })

  it('quotes empty strings', () => {
    expect(toYaml('')).toBe('""')
  })

  it('quotes strings with special characters', () => {
    expect(toYaml('hello: world')).toBe('"hello: world"')
    expect(toYaml('key=value')).toBe('"key=value"')
  })

  it('serialises empty arrays', () => {
    expect(toYaml([])).toBe('[]')
  })

  it('serialises empty objects', () => {
    expect(toYaml({})).toBe('{}')
  })

  it('serialises flat objects', () => {
    const result = toYaml({ name: 'test', count: 42, active: true })
    expect(result).toContain('name: test')
    expect(result).toContain('count: 42')
    expect(result).toContain('active: true')
  })

  it('serialises arrays of primitives', () => {
    const result = toYaml(['a', 'b', 'c'])
    expect(result).toBe('- a\n- b\n- c')
  })

  it('serialises nested objects', () => {
    const result = toYaml({ auth: { type: 'bearer' } })
    expect(result).toContain('auth:')
    expect(result).toContain('  type: bearer')
  })

  it('serialises arrays of objects', () => {
    const result = toYaml([{ name: 'a' }, { name: 'b' }])
    expect(result).toContain('- name: a')
    expect(result).toContain('- name: b')
  })

  it('handles null values in objects', () => {
    const result = toYaml({ key: null })
    expect(result).toBe('key: null')
  })

  it('round-trips a realistic OAS service list entry', () => {
    const entry = {
      id: 'abc-123',
      name: 'payments',
      description: 'Payments service',
      authType: 'bearer',
      authConfig: { type: 'bearer' },
      cacheTtl: 3600,
      enabled: true,
    }
    const yaml = toYaml([entry])
    expect(yaml).toContain('name: payments')
    expect(yaml).toContain('description: Payments service')
    expect(yaml).toContain('authType: bearer')
    expect(yaml).toContain('cacheTtl: 3600')
    expect(yaml).toContain('enabled: true')
  })
})
