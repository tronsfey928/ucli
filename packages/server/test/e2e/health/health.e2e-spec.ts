import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { createTestApp } from '../setup'

describe('Health (e2e)', () => {
  let app: INestApplication

  beforeAll(async () => { app = await createTestApp() })
  afterAll(async () => { await app.close() })

  it('GET /api/v1/health → 200 ok', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ status: 'ok' })
    expect(res.body.timestamp).toBeDefined()
  })

  it('GET /api/v1/ready → 200 ready', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/ready')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
  })
})
