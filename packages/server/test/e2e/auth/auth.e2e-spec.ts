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

  describe('Scope Enforcement', () => {
    it('returns 403 when token lacks required scopes for OAS endpoints', async () => {
      const server = app.getHttpServer()

      // Create group + token with only mcp:read scope (no oas:read)
      const grp = await request(server).post('/admin/groups').set(ADMIN_HEADERS).send({ name: `scope-test-${Date.now()}` })
      const issue = await request(server)
        .post(`/admin/groups/${grp.body.id}/tokens`)
        .set(ADMIN_HEADERS)
        .send({ name: 'mcp-only', scopes: ['mcp:read'] })
      const { jwt } = issue.body

      // OAS endpoint should return 403 (insufficient scopes)
      const oasRes = await request(server).get('/api/v1/oas').set('Authorization', `Bearer ${jwt}`)
      expect(oasRes.status).toBe(403)

      // MCP endpoint should return 200 (scope satisfied)
      const mcpRes = await request(server).get('/api/v1/mcp').set('Authorization', `Bearer ${jwt}`)
      expect(mcpRes.status).toBe(200)
    })

    it('returns 403 when token lacks required scopes for MCP endpoints', async () => {
      const server = app.getHttpServer()

      // Create group + token with only oas:read scope (no mcp:read)
      const grp = await request(server).post('/admin/groups').set(ADMIN_HEADERS).send({ name: `scope-test2-${Date.now()}` })
      const issue = await request(server)
        .post(`/admin/groups/${grp.body.id}/tokens`)
        .set(ADMIN_HEADERS)
        .send({ name: 'oas-only', scopes: ['oas:read'] })
      const { jwt } = issue.body

      // MCP endpoint should return 403 (insufficient scopes)
      const mcpRes = await request(server).get('/api/v1/mcp').set('Authorization', `Bearer ${jwt}`)
      expect(mcpRes.status).toBe(403)

      // OAS endpoint should return 200 (scope satisfied)
      const oasRes = await request(server).get('/api/v1/oas').set('Authorization', `Bearer ${jwt}`)
      expect(oasRes.status).toBe(200)
    })
  })
})
