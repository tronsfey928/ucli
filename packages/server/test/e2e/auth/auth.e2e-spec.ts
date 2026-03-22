import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { createTestApp, ADMIN_HEADERS } from '../setup'

describe('Authentication (e2e)', () => {
  let app: INestApplication

  beforeAll(async () => { app = await createTestApp() })
  afterAll(async () => { await app.close() })

  describe('Admin Secret', () => {
    it('returns 401 when X-Admin-Secret is missing', async () => {
      const res = await request(app.getHttpServer()).get('/admin/groups')
      expect(res.status).toBe(401)
    })

    it('returns 401 when X-Admin-Secret is wrong', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/groups')
        .set('x-admin-secret', 'wrong-secret')
      expect(res.status).toBe(401)
    })

    it('returns 200 with correct secret', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/groups')
        .set(ADMIN_HEADERS)
      expect(res.status).toBe(200)
    })
  })

  describe('Group Token Revocation', () => {
    it('revoked token is rejected on subsequent requests', async () => {
      const server = app.getHttpServer()

      // Create group + token
      const grp = await request(server).post('/admin/groups').set(ADMIN_HEADERS).send({ name: `revoke-test-${Date.now()}` })
      const issue = await request(server).post(`/admin/groups/${grp.body.id}/tokens`).set(ADMIN_HEADERS).send({ name: 'revokable' })
      const { jwt, token } = issue.body

      // Token should work
      const ok = await request(server).get('/api/v1/oas').set('Authorization', `Bearer ${jwt}`)
      expect(ok.status).toBe(200)

      // Revoke
      await request(server).delete(`/admin/tokens/${token.id}`).set(ADMIN_HEADERS)

      // Token should now be rejected
      const rejected = await request(server).get('/api/v1/oas').set('Authorization', `Bearer ${jwt}`)
      expect(rejected.status).toBe(401)
    })
  })
})
