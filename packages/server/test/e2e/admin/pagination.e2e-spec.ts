import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { createTestApp, ADMIN_HEADERS } from '../setup'

describe('Pagination (e2e)', () => {
  let app: INestApplication
  let groupId: string
  let counter = 0

  beforeAll(async () => {
    app = await createTestApp()
    const res = await request(app.getHttpServer())
      .post('/admin/groups')
      .set(ADMIN_HEADERS)
      .send({ name: 'pagination-test-group' })
    groupId = res.body.id

    // Create 5 OAS entries
    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer())
        .post('/admin/oas')
        .set(ADMIN_HEADERS)
        .send({
          groupId,
          name: `pagination-svc-${++counter}`,
          description: `Service ${counter}`,
          remoteUrl: 'https://petstore3.swagger.io/api/v3/openapi.json',
          authType: 'none',
          authConfig: { type: 'none' },
          cacheTtl: 3600,
        })
    }

    // Create 3 MCP entries
    for (let i = 0; i < 3; i++) {
      await request(app.getHttpServer())
        .post('/admin/mcp')
        .set(ADMIN_HEADERS)
        .send({
          groupId,
          name: `pagination-mcp-${++counter}`,
          description: `MCP ${counter}`,
          transport: 'stdio',
          command: 'echo hello',
          authConfig: { type: 'none' },
        })
    }
  })

  afterAll(async () => { await app.close() })

  // ── Admin OAS pagination ──────────────────────────────────────────

  it('GET /admin/oas → returns array when no pagination params', async () => {
    const res = await request(app.getHttpServer()).get('/admin/oas').set(ADMIN_HEADERS)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })

  it('GET /admin/oas?page=1&limit=2 → returns paginated response', async () => {
    const res = await request(app.getHttpServer())
      .get('/admin/oas?page=1&limit=2')
      .set(ADMIN_HEADERS)
    expect(res.status).toBe(200)
    expect(res.body.data).toBeDefined()
    expect(res.body.meta).toBeDefined()
    expect(res.body.data.length).toBeLessThanOrEqual(2)
    expect(res.body.meta.page).toBe(1)
    expect(res.body.meta.limit).toBe(2)
    expect(res.body.meta.total).toBeGreaterThanOrEqual(5)
    expect(res.body.meta.totalPages).toBeGreaterThanOrEqual(3)
  })

  it('GET /admin/oas?page=2&limit=2 → returns second page', async () => {
    const res = await request(app.getHttpServer())
      .get('/admin/oas?page=2&limit=2')
      .set(ADMIN_HEADERS)
    expect(res.status).toBe(200)
    expect(res.body.data.length).toBeLessThanOrEqual(2)
    expect(res.body.meta.page).toBe(2)
  })

  // ── Admin MCP pagination ──────────────────────────────────────────

  it('GET /admin/mcp → returns array when no pagination params', async () => {
    const res = await request(app.getHttpServer()).get('/admin/mcp').set(ADMIN_HEADERS)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })

  it('GET /admin/mcp?page=1&limit=2 → returns paginated response', async () => {
    const res = await request(app.getHttpServer())
      .get('/admin/mcp?page=1&limit=2')
      .set(ADMIN_HEADERS)
    expect(res.status).toBe(200)
    expect(res.body.data.length).toBeLessThanOrEqual(2)
    expect(res.body.meta.page).toBe(1)
    expect(res.body.meta.limit).toBe(2)
    expect(res.body.meta.total).toBeGreaterThanOrEqual(3)
  })

  // ── Admin Groups pagination ───────────────────────────────────────

  it('GET /admin/groups → returns array when no pagination params', async () => {
    const res = await request(app.getHttpServer()).get('/admin/groups').set(ADMIN_HEADERS)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })

  it('GET /admin/groups?page=1&limit=1 → returns paginated response', async () => {
    const res = await request(app.getHttpServer())
      .get('/admin/groups?page=1&limit=1')
      .set(ADMIN_HEADERS)
    expect(res.status).toBe(200)
    expect(res.body.data).toBeDefined()
    expect(res.body.data.length).toBe(1)
    expect(res.body.meta.page).toBe(1)
    expect(res.body.meta.limit).toBe(1)
    expect(res.body.meta.total).toBeGreaterThanOrEqual(1)
  })

  // ── Client OAS pagination ─────────────────────────────────────────

  it('GET /api/v1/oas?page=1&limit=2 → returns paginated response for client', async () => {
    // First, get a token for this group
    const tokenRes = await request(app.getHttpServer())
      .post(`/admin/groups/${groupId}/tokens`)
      .set(ADMIN_HEADERS)
      .send({ name: 'pagination-token' })
    const jwt = tokenRes.body.jwt

    const res = await request(app.getHttpServer())
      .get('/api/v1/oas?page=1&limit=2')
      .set('Authorization', `Bearer ${jwt}`)
    expect(res.status).toBe(200)
    expect(res.body.data).toBeDefined()
    expect(res.body.data.length).toBeLessThanOrEqual(2)
    expect(res.body.meta.page).toBe(1)
    expect(res.body.meta.limit).toBe(2)
    expect(res.body.meta.total).toBeGreaterThanOrEqual(5)
  })

  // ── Client MCP pagination ─────────────────────────────────────────

  it('GET /api/v1/mcp?page=1&limit=1 → returns paginated response for client', async () => {
    const tokenRes = await request(app.getHttpServer())
      .post(`/admin/groups/${groupId}/tokens`)
      .set(ADMIN_HEADERS)
      .send({ name: 'pagination-token-mcp' })
    const jwt = tokenRes.body.jwt

    const res = await request(app.getHttpServer())
      .get('/api/v1/mcp?page=1&limit=1')
      .set('Authorization', `Bearer ${jwt}`)
    expect(res.status).toBe(200)
    expect(res.body.data).toBeDefined()
    expect(res.body.data.length).toBe(1)
    expect(res.body.meta.page).toBe(1)
    expect(res.body.meta.limit).toBe(1)
    expect(res.body.meta.total).toBeGreaterThanOrEqual(3)
  })

  // ── Validation ────────────────────────────────────────────────────

  it('GET /admin/oas?page=0 → 400 (page must be >= 1)', async () => {
    const res = await request(app.getHttpServer())
      .get('/admin/oas?page=0')
      .set(ADMIN_HEADERS)
    expect(res.status).toBe(400)
  })

  it('GET /admin/oas?limit=101 → 400 (limit max 100)', async () => {
    const res = await request(app.getHttpServer())
      .get('/admin/oas?limit=101')
      .set(ADMIN_HEADERS)
    expect(res.status).toBe(400)
  })

  it('GET /admin/oas?limit=-1 → 400 (limit must be >= 1)', async () => {
    const res = await request(app.getHttpServer())
      .get('/admin/oas?limit=-1')
      .set(ADMIN_HEADERS)
    expect(res.status).toBe(400)
  })
})
