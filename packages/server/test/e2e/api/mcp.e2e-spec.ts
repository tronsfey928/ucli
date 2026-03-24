import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { createTestApp, ADMIN_HEADERS } from '../setup'

describe('Client MCP API (e2e)', () => {
  let app: INestApplication
  let groupAToken: string
  let groupBToken: string
  let groupAId: string

  beforeAll(async () => {
    app = await createTestApp()
    const server = app.getHttpServer()

    // Group A
    const gA = await request(server).post('/admin/groups').set(ADMIN_HEADERS).send({ name: 'mcp-group-a' })
    groupAId = gA.body.id
    const tA = await request(server).post(`/admin/groups/${groupAId}/tokens`).set(ADMIN_HEADERS).send({ name: 'mcp-agent-a' })
    groupAToken = tA.body.jwt

    // Group B (different group, should not see group A's MCP servers)
    const gB = await request(server).post('/admin/groups').set(ADMIN_HEADERS).send({ name: 'mcp-group-b' })
    const tB = await request(server).post(`/admin/groups/${gB.body.id}/tokens`).set(ADMIN_HEADERS).send({ name: 'mcp-agent-b' })
    groupBToken = tB.body.jwt

    // Register MCP server for group A
    await request(server).post('/admin/mcp').set(ADMIN_HEADERS).send({
      groupId: groupAId,
      name: 'weather-mcp',
      description: 'Weather MCP server',
      transport: 'http',
      serverUrl: 'https://weather.mcp.example.com/sse',
      authConfig: { type: 'http_headers', headers: { Authorization: 'Bearer secret-weather-token' } },
    })
  })

  afterAll(async () => { await app.close() })

  it('GET /api/v1/mcp → 200 returns group A MCP servers with decrypted authConfig', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/mcp')
      .set('Authorization', `Bearer ${groupAToken}`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body.length).toBe(1)
    expect(res.body[0].name).toBe('weather-mcp')
    expect(res.body[0].authConfig).toMatchObject({ type: 'http_headers', headers: { Authorization: 'Bearer secret-weather-token' } })
  })

  it('GET /api/v1/mcp → group B sees empty list (group isolation)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/mcp')
      .set('Authorization', `Bearer ${groupBToken}`)

    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })

  it('GET /api/v1/mcp/:name → 200 returns named entry with decrypted authConfig', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/mcp/weather-mcp')
      .set('Authorization', `Bearer ${groupAToken}`)

    expect(res.status).toBe(200)
    expect(res.body.name).toBe('weather-mcp')
    expect(res.body.authConfig).toMatchObject({ type: 'http_headers', headers: { Authorization: 'Bearer secret-weather-token' } })
  })

  it('GET /api/v1/mcp/:name → 404 for unknown name', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/mcp/nonexistent')
      .set('Authorization', `Bearer ${groupAToken}`)

    expect(res.status).toBe(404)
  })

  it('GET /api/v1/mcp/:name → 404 when group B requests group A server (group isolation)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/mcp/weather-mcp')
      .set('Authorization', `Bearer ${groupBToken}`)

    expect(res.status).toBe(404)
  })

  it('GET /api/v1/mcp → 401 without token', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/mcp')
    expect(res.status).toBe(401)
  })

  it('GET /api/v1/mcp → 401 with invalid token', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/mcp')
      .set('Authorization', 'Bearer invalid.jwt.here')
    expect(res.status).toBe(401)
  })

  it('disabled MCP server does not appear in client list', async () => {
    const server = app.getHttpServer()
    // Register a second MCP server for group A
    const create = await request(server).post('/admin/mcp').set(ADMIN_HEADERS).send({
      groupId: groupAId,
      name: 'disabled-mcp',
      description: 'Will be disabled',
      transport: 'http',
      serverUrl: 'https://disabled.mcp.example.com/sse',
      authConfig: { type: 'none' },
    })
    const id = create.body.id

    // Disable it
    await request(server).put(`/admin/mcp/${id}`).set(ADMIN_HEADERS).send({ enabled: false })

    // Client should not see it
    const res = await request(server)
      .get('/api/v1/mcp')
      .set('Authorization', `Bearer ${groupAToken}`)

    expect(res.status).toBe(200)
    const names = res.body.map((e: { name: string }) => e.name)
    expect(names).not.toContain('disabled-mcp')
    expect(names).toContain('weather-mcp')
  })

  it('disabled MCP entry returns 404 on GET /api/v1/mcp/:name', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/mcp/disabled-mcp')
      .set('Authorization', `Bearer ${groupAToken}`)
    expect(res.status).toBe(404)
  })
})
