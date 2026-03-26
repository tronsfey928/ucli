import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { createTestApp, ADMIN_HEADERS } from '../setup'

describe('Admin OAS (e2e)', () => {
  let app: INestApplication
  let groupId: string
  let oasCounter = 0

  const oasPayload = () => ({
    groupId,
    name: `svc-${Date.now()}-${++oasCounter}`,
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

  it('POST /admin/oas → different groups can use the same name', async () => {
    const server = app.getHttpServer()
    // Create a second group
    const g2 = await request(server).post('/admin/groups').set(ADMIN_HEADERS).send({ name: 'oas-group-2' })
    const groupId2 = g2.body.id

    const sharedName = `shared-svc-${Date.now()}`
    const base = {
      name: sharedName,
      description: 'shared',
      remoteUrl: 'https://example.com/oas.json',
      authType: 'none',
      authConfig: { type: 'none' },
    }

    const r1 = await request(server).post('/admin/oas').set(ADMIN_HEADERS).send({ ...base, groupId })
    expect(r1.status).toBe(201)

    const r2 = await request(server).post('/admin/oas').set(ADMIN_HEADERS).send({ ...base, groupId: groupId2 })
    expect(r2.status).toBe(201)

    // Both entries exist with same name but different groups
    expect(r1.body.groupId).toBe(groupId)
    expect(r2.body.groupId).toBe(groupId2)
    expect(r1.body.name).toBe(sharedName)
    expect(r2.body.name).toBe(sharedName)
  })

  it('PUT /admin/oas/:id → 409 when renaming to an existing name in same group', async () => {
    const server = app.getHttpServer()
    const p1 = oasPayload()
    const p2 = oasPayload()

    const r1 = await request(server).post('/admin/oas').set(ADMIN_HEADERS).send(p1)
    await request(server).post('/admin/oas').set(ADMIN_HEADERS).send(p2)

    const res = await request(server)
      .put(`/admin/oas/${r1.body.id}`)
      .set(ADMIN_HEADERS)
      .send({ name: p2.name })

    expect(res.status).toBe(409)
  })
})
