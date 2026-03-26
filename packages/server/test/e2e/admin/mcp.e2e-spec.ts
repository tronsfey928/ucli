import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { createTestApp, ADMIN_HEADERS } from '../setup'

describe('Admin MCP (e2e)', () => {
  let app: INestApplication
  let groupId: string
  let mcpCounter = 0

  const mcpPayload = () => ({
    groupId,
    name: `mcp-${Date.now()}-${++mcpCounter}`,
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

  it('POST /admin/mcp → different groups can use the same name', async () => {
    const server = app.getHttpServer()
    const g2 = await request(server).post('/admin/groups').set(ADMIN_HEADERS).send({ name: 'mcp-group-2' })
    const groupId2 = g2.body.id

    const sharedName = `shared-mcp-${Date.now()}`
    const base = {
      name: sharedName,
      description: 'shared MCP',
      transport: 'http' as const,
      serverUrl: 'https://mcp.example.com/sse',
      authConfig: { type: 'none' },
    }

    const r1 = await request(server).post('/admin/mcp').set(ADMIN_HEADERS).send({ ...base, groupId })
    expect(r1.status).toBe(201)

    const r2 = await request(server).post('/admin/mcp').set(ADMIN_HEADERS).send({ ...base, groupId: groupId2 })
    expect(r2.status).toBe(201)

    expect(r1.body.groupId).toBe(groupId)
    expect(r2.body.groupId).toBe(groupId2)
  })

  it('POST /admin/mcp → 400 when http transport missing serverUrl', async () => {
    const res = await request(app.getHttpServer())
      .post('/admin/mcp')
      .set(ADMIN_HEADERS)
      .send({
        groupId,
        name: `mcp-bad-http-${Date.now()}`,
        transport: 'http',
        authConfig: { type: 'none' },
      })
    expect(res.status).toBe(400)
  })

  it('POST /admin/mcp → 400 when stdio transport missing command', async () => {
    const res = await request(app.getHttpServer())
      .post('/admin/mcp')
      .set(ADMIN_HEADERS)
      .send({
        groupId,
        name: `mcp-bad-stdio-${Date.now()}`,
        transport: 'stdio',
        authConfig: { type: 'none' },
      })
    expect(res.status).toBe(400)
  })

  it('PUT /admin/mcp/:id → 409 when renaming to an existing name in same group', async () => {
    const server = app.getHttpServer()
    const p1 = mcpPayload()
    const p2 = mcpPayload()

    const r1 = await request(server).post('/admin/mcp').set(ADMIN_HEADERS).send(p1)
    await request(server).post('/admin/mcp').set(ADMIN_HEADERS).send(p2)

    const res = await request(server)
      .put(`/admin/mcp/${r1.body.id}`)
      .set(ADMIN_HEADERS)
      .send({ name: p2.name })

    expect(res.status).toBe(409)
  })
})
