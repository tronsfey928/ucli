import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import * as http from 'http'
import { createTestApp, ADMIN_HEADERS } from '../setup'

describe('Admin MCP Probe (e2e)', () => {
  let app: INestApplication
  let fakeServer: http.Server
  let fakePort: number

  beforeAll(async () => {
    app = await createTestApp()

    // Create a minimal HTTP server that simulates an MCP endpoint
    fakeServer = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/plain' })
      res.end('ok')
    })

    await new Promise<void>((resolve) => {
      fakeServer.listen(0, '127.0.0.1', () => {
        const addr = fakeServer.address() as { port: number }
        fakePort = addr.port
        resolve()
      })
    })
  })

  afterAll(async () => {
    await app.close()
    await new Promise<void>((resolve) => fakeServer.close(() => resolve()))
  })

  it('POST /admin/mcp/probe — returns ok for reachable server', async () => {
    const res = await request(app.getHttpServer())
      .post('/admin/mcp/probe')
      .set(ADMIN_HEADERS)
      .send({ serverUrl: `http://127.0.0.1:${fakePort}` })
      .expect(200)

    expect(res.body.status).toBe('ok')
    expect(res.body.latencyMs).toBeGreaterThanOrEqual(0)
    expect(res.body.message).toContain('200')
  })

  it('POST /admin/mcp/probe — returns error for unreachable server', async () => {
    const res = await request(app.getHttpServer())
      .post('/admin/mcp/probe')
      .set(ADMIN_HEADERS)
      .send({ serverUrl: 'http://127.0.0.1:1' })
      .expect(200)

    expect(res.body.status).toBe('error')
    expect(res.body.message).toContain('Connection failed')
    expect(res.body.latencyMs).toBeGreaterThanOrEqual(0)
  })

  it('POST /admin/mcp/probe — requires admin auth', async () => {
    await request(app.getHttpServer())
      .post('/admin/mcp/probe')
      .send({ serverUrl: `http://127.0.0.1:${fakePort}` })
      .expect(401)
  })
})
