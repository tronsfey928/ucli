import { describe, it, expect, vi, beforeEach } from 'vitest'
import axios from 'axios'

vi.mock('axios', () => {
  const mockAxios = {
    create: vi.fn().mockReturnThis(),
    get: vi.fn(),
    interceptors: {
      response: { use: vi.fn() },
    },
    defaults: { headers: { common: {} } },
  }
  return { default: mockAxios, isAxiosError: vi.fn() }
})

describe('ServerClient', () => {
  const cfg = { serverUrl: 'http://localhost:3000', token: 'test-jwt' }

  beforeEach(() => { vi.clearAllMocks() })

  it('is instantiated without error', async () => {
    const { ServerClient } = await import('../src/lib/server-client.js')
    expect(() => new ServerClient(cfg)).not.toThrow()
  })
})
