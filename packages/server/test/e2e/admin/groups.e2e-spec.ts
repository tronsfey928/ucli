import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { createTestApp, ADMIN_HEADERS } from '../setup'

describe('Admin Groups (e2e)', () => {
  let app: INestApplication

  beforeAll(async () => { app = await createTestApp() })
  afterAll(async () => { await app.close() })

  it('POST /admin/groups → 201 creates group', async () => {
    const res = await request(app.getHttpServer())
      .post('/admin/groups')
      .set(ADMIN_HEADERS)
      .send({ name: 'test-group', description: 'Test group' })

    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ name: 'test-group', description: 'Test group' })
    expect(res.body.id).toBeDefined()
    expect(res.body.createdAt).toBeDefined()
  })

  it('POST /admin/groups → 409 on duplicate name', async () => {
    await request(app.getHttpServer())
      .post('/admin/groups')
      .set(ADMIN_HEADERS)
      .send({ name: 'dup-group' })

    const res = await request(app.getHttpServer())
      .post('/admin/groups')
      .set(ADMIN_HEADERS)
      .send({ name: 'dup-group' })

    expect(res.status).toBe(409)
  })

  it('POST /admin/groups → 400 on invalid name', async () => {
    const res = await request(app.getHttpServer())
      .post('/admin/groups')
      .set(ADMIN_HEADERS)
      .send({ name: 'INVALID NAME!' })

    expect(res.status).toBe(400)
  })

  it('POST /admin/groups → 401 without admin secret', async () => {
    const res = await request(app.getHttpServer())
      .post('/admin/groups')
      .send({ name: 'no-auth' })

    expect(res.status).toBe(401)
  })

  it('GET /admin/groups → 200 returns list', async () => {
    await request(app.getHttpServer())
      .post('/admin/groups')
      .set(ADMIN_HEADERS)
      .send({ name: 'list-group' })

    const res = await request(app.getHttpServer())
      .get('/admin/groups')
      .set(ADMIN_HEADERS)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body.some((g: { name: string }) => g.name === 'list-group')).toBe(true)
  })
})
