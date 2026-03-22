import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { createTestApp, ADMIN_HEADERS } from '../setup'

describe('Client OAS API (e2e)', () => {
  let app: INestApplication
  let groupAToken: string
  let groupBToken: string
  let groupAId: string

  beforeAll(async () => {
    app = await createTestApp()
    const server = app.getHttpServer()

    // Group A
    const gA = await request(server).post('/admin/groups').set(ADMIN_HEADERS).send({ name: 'group-a' })
    groupAId = gA.body.id
    const tA = await request(server).post(`/admin/groups/${groupAId}/tokens`).set(ADMIN_HEADERS).send({ name: 'agent-a' })
    groupAToken = tA.body.jwt

    // Group B (different group, should not see group A's OAS)
    const gB = await request(server).post('/admin/groups').set(ADMIN_HEADERS).send({ name: 'group-b' })
    const tB = await request(server).post(`/admin/groups/${gB.body.id}/tokens`).set(ADMIN_HEADERS).send({ name: 'agent-b' })
    groupBToken = tB.body.jwt

    // Register OAS for group A
    await request(server).post('/admin/oas').set(ADMIN_HEADERS).send({
      groupId: groupAId,
      name: 'petstore',
      description: 'Pet Store API',
      remoteUrl: 'https://petstore3.swagger.io/api/v3/openapi.json',
      authType: 'bearer',
      authConfig: { type: 'bearer', token: 'secret-token' },
      cacheTtl: 3600,
    })
  })

  afterAll(async () => { await app.close() })

  it('GET /api/v1/oas → 200 returns group A OAS entries', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/oas')
      .set('Authorization', `Bearer ${groupAToken}`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body.length).toBe(1)
    expect(res.body[0].name).toBe('petstore')
    // authConfig is decrypted and returned to CLI
    expect(res.body[0].authConfig).toMatchObject({ type: 'bearer', token: 'secret-token' })
  })

  it('GET /api/v1/oas → group B sees empty list (group isolation)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/oas')
      .set('Authorization', `Bearer ${groupBToken}`)

    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })

  it('GET /api/v1/oas/:name → 200 returns named entry', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/oas/petstore')
      .set('Authorization', `Bearer ${groupAToken}`)

    expect(res.status).toBe(200)
    expect(res.body.name).toBe('petstore')
  })

  it('GET /api/v1/oas/:name → 404 for unknown name', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/oas/nonexistent')
      .set('Authorization', `Bearer ${groupAToken}`)

    expect(res.status).toBe(404)
  })

  it('GET /api/v1/oas → 401 without token', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/oas')
    expect(res.status).toBe(401)
  })

  it('GET /api/v1/oas → 401 with invalid token', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/oas')
      .set('Authorization', 'Bearer invalid.jwt.here')
    expect(res.status).toBe(401)
  })
})
