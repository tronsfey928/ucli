import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { createTestApp, ADMIN_HEADERS } from '../setup'

describe('Admin OAS (e2e)', () => {
  let app: INestApplication
  let groupId: string

  const oasPayload = () => ({
    groupId,
    name: `svc-${Date.now()}`,
    description: 'Test service',
    remoteUrl: 'https://petstore3.swagger.io/api/v3/openapi.json',
    authType: 'none',
    authConfig: { type: 'none' },
    cacheTtl: 3600,
  })

  beforeAll(async () => {
    app = await createTestApp()
    const res = await request(app.getHttpServer())
      .post('/admin/groups')
      .set(ADMIN_HEADERS)
      .send({ name: 'oas-test-group' })
    groupId = res.body.id
  })
  afterAll(async () => { await app.close() })

  it('POST /admin/oas → 201 creates OAS entry', async () => {
    const payload = oasPayload()
    const res = await request(app.getHttpServer())
      .post('/admin/oas')
      .set(ADMIN_HEADERS)
      .send(payload)

    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ name: payload.name, groupId, enabled: true })
    expect(res.body.id).toBeDefined()
    // authConfig should be decrypted on admin response
    expect(res.body.authConfig).toMatchObject({ type: 'none' })
  })

  it('POST /admin/oas → 409 on duplicate name', async () => {
    const payload = oasPayload()
    await request(app.getHttpServer()).post('/admin/oas').set(ADMIN_HEADERS).send(payload)
    const res = await request(app.getHttpServer()).post('/admin/oas').set(ADMIN_HEADERS).send(payload)
    expect(res.status).toBe(409)
  })

  it('GET /admin/oas → 200 returns all entries', async () => {
    const res = await request(app.getHttpServer()).get('/admin/oas').set(ADMIN_HEADERS)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })

  it('PUT /admin/oas/:id → 200 updates entry', async () => {
    const payload = oasPayload()
    const create = await request(app.getHttpServer()).post('/admin/oas').set(ADMIN_HEADERS).send(payload)
    const id = create.body.id

    const res = await request(app.getHttpServer())
      .put(`/admin/oas/${id}`)
      .set(ADMIN_HEADERS)
      .send({ description: 'Updated description', cacheTtl: 7200 })

    expect(res.status).toBe(200)
    expect(res.body.description).toBe('Updated description')
    expect(res.body.cacheTtl).toBe(7200)
  })

  it('PUT /admin/oas/:id → updates authConfig (re-encrypted)', async () => {
    const payload = { ...oasPayload(), authType: 'bearer', authConfig: { type: 'bearer', token: 'old-token' } }
    const create = await request(app.getHttpServer()).post('/admin/oas').set(ADMIN_HEADERS).send(payload)
    const id = create.body.id

    const res = await request(app.getHttpServer())
      .put(`/admin/oas/${id}`)
      .set(ADMIN_HEADERS)
      .send({ authConfig: { type: 'bearer', token: 'new-token' } })

    expect(res.status).toBe(200)
    expect(res.body.authConfig).toMatchObject({ type: 'bearer', token: 'new-token' })
  })

  it('DELETE /admin/oas/:id → 204', async () => {
    const payload = oasPayload()
    const create = await request(app.getHttpServer()).post('/admin/oas').set(ADMIN_HEADERS).send(payload)
    const id = create.body.id

    const res = await request(app.getHttpServer()).delete(`/admin/oas/${id}`).set(ADMIN_HEADERS)
    expect(res.status).toBe(204)
  })
})
