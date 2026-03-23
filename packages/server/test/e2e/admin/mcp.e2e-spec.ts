import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { createTestApp, ADMIN_HEADERS } from '../setup'

describe('Admin MCP (e2e)', () => {
  let app: INestApplication
  let groupId: string

  const mcpPayload = () => ({
    groupId,
    name: `mcp-${Date.now()}`,
    description: 'Test MCP server',
    transport: 'http',
    serverUrl: 'https://mcp.example.com/sse',
    authConfig: { type: 'none' },
  })

  beforeAll(async () => {
    app = await createTestApp()
    const res = await request(app.getHttpServer())
      .post('/admin/groups')
      .set(ADMIN_HEADERS)
      .send({ name: 'mcp-test-group' })
    groupId = res.body.id
  })
  afterAll(async () => { await app.close() })

  it('POST /admin/mcp → 201 creates MCP server', async () => {
    const payload = mcpPayload()
    const res = await request(app.getHttpServer())
      .post('/admin/mcp')
      .set(ADMIN_HEADERS)
      .send(payload)

    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ name: payload.name, groupId, enabled: true, transport: 'http' })
    expect(res.body.id).toBeDefined()
    // authConfig should be decrypted on admin response
    expect(res.body.authConfig).toMatchObject({ type: 'none' })
  })

  it('POST /admin/mcp → 409 on duplicate name', async () => {
    const payload = mcpPayload()
    await request(app.getHttpServer()).post('/admin/mcp').set(ADMIN_HEADERS).send(payload)
    const res = await request(app.getHttpServer()).post('/admin/mcp').set(ADMIN_HEADERS).send(payload)
    expect(res.status).toBe(409)
  })

  it('GET /admin/mcp → 200 returns all entries', async () => {
    const res = await request(app.getHttpServer()).get('/admin/mcp').set(ADMIN_HEADERS)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })

  it('GET /admin/mcp/:id → 200 returns single entry with decrypted authConfig', async () => {
    const payload = { ...mcpPayload(), authConfig: { type: 'http_headers', headers: { Authorization: 'Bearer secret' } } }
    const create = await request(app.getHttpServer()).post('/admin/mcp').set(ADMIN_HEADERS).send(payload)
    const id = create.body.id

    const res = await request(app.getHttpServer()).get(`/admin/mcp/${id}`).set(ADMIN_HEADERS)
    expect(res.status).toBe(200)
    expect(res.body.id).toBe(id)
    expect(res.body.authConfig).toMatchObject({ type: 'http_headers', headers: { Authorization: 'Bearer secret' } })
  })

  it('PUT /admin/mcp/:id → 200 updates description', async () => {
    const payload = mcpPayload()
    const create = await request(app.getHttpServer()).post('/admin/mcp').set(ADMIN_HEADERS).send(payload)
    const id = create.body.id

    const res = await request(app.getHttpServer())
      .put(`/admin/mcp/${id}`)
      .set(ADMIN_HEADERS)
      .send({ description: 'Updated description' })

    expect(res.status).toBe(200)
    expect(res.body.description).toBe('Updated description')
  })

  it('PUT /admin/mcp/:id → updates authConfig (re-encrypted)', async () => {
    const payload = { ...mcpPayload(), authConfig: { type: 'http_headers', headers: { Authorization: 'Bearer old-token' } } }
    const create = await request(app.getHttpServer()).post('/admin/mcp').set(ADMIN_HEADERS).send(payload)
    const id = create.body.id

    const res = await request(app.getHttpServer())
      .put(`/admin/mcp/${id}`)
      .set(ADMIN_HEADERS)
      .send({ authConfig: { type: 'http_headers', headers: { Authorization: 'Bearer new-token' } } })

    expect(res.status).toBe(200)
    expect(res.body.authConfig).toMatchObject({ type: 'http_headers', headers: { Authorization: 'Bearer new-token' } })
  })

  it('DELETE /admin/mcp/:id → 204', async () => {
    const payload = mcpPayload()
    const create = await request(app.getHttpServer()).post('/admin/mcp').set(ADMIN_HEADERS).send(payload)
    const id = create.body.id

    const res = await request(app.getHttpServer()).delete(`/admin/mcp/${id}`).set(ADMIN_HEADERS)
    expect(res.status).toBe(204)
  })

  it('POST /admin/mcp → 401 without admin secret', async () => {
    const res = await request(app.getHttpServer()).post('/admin/mcp').send(mcpPayload())
    expect(res.status).toBe(401)
  })

  it('POST /admin/mcp with stdio transport → 201 using command field', async () => {
    const payload = {
      groupId,
      name: `mcp-stdio-${Date.now()}`,
      description: 'Stdio MCP server',
      transport: 'stdio',
      command: 'npx -y my-mcp-server',
      authConfig: { type: 'env', env: { API_KEY: 'my-key' } },
    }
    const res = await request(app.getHttpServer())
      .post('/admin/mcp')
      .set(ADMIN_HEADERS)
      .send(payload)

    expect(res.status).toBe(201)
    expect(res.body.transport).toBe('stdio')
    expect(res.body.command).toBe('npx -y my-mcp-server')
    expect(res.body.authConfig).toMatchObject({ type: 'env', env: { API_KEY: 'my-key' } })
  })
})
