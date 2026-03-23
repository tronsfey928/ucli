import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { createTestApp, ADMIN_HEADERS } from '../setup'

describe('Admin Tokens (e2e)', () => {
  let app: INestApplication
  let groupId: string

  beforeAll(async () => {
    app = await createTestApp()
    const res = await request(app.getHttpServer())
      .post('/admin/groups')
      .set(ADMIN_HEADERS)
      .send({ name: 'token-test-group' })
    groupId = res.body.id
  })
  afterAll(async () => { await app.close() })

  it('POST /admin/groups/:id/tokens → 201 issues JWT', async () => {
    const res = await request(app.getHttpServer())
      .post(`/admin/groups/${groupId}/tokens`)
      .set(ADMIN_HEADERS)
      .send({ name: 'agent-token', ttlSec: 3600 })

    expect(res.status).toBe(201)
    expect(res.body.jwt).toBeDefined()
    expect(typeof res.body.jwt).toBe('string')
    expect(res.body.token).toMatchObject({ name: 'agent-token', groupId })
  })

  it('POST /admin/groups/:id/tokens → 404 for unknown group', async () => {
    const res = await request(app.getHttpServer())
      .post('/admin/groups/00000000-0000-0000-0000-000000000000/tokens')
      .set(ADMIN_HEADERS)
      .send({ name: 'token' })

    expect(res.status).toBe(404)
  })

  it('DELETE /admin/tokens/:id → 204 revokes token', async () => {
    const issue = await request(app.getHttpServer())
      .post(`/admin/groups/${groupId}/tokens`)
      .set(ADMIN_HEADERS)
      .send({ name: 'to-revoke' })

    const tokenId = issue.body.token.id

    const revoke = await request(app.getHttpServer())
      .delete(`/admin/tokens/${tokenId}`)
      .set(ADMIN_HEADERS)

    expect(revoke.status).toBe(204)
  })

  it('DELETE /admin/tokens/:id → 404 for unknown token', async () => {
    const res = await request(app.getHttpServer())
      .delete('/admin/tokens/00000000-0000-0000-0000-000000000000')
      .set(ADMIN_HEADERS)

    expect(res.status).toBe(404)
  })

  describe('GET /admin/groups/:id/tokens', () => {
    it('returns empty array for group with no tokens', async () => {
      const grp = await request(app.getHttpServer())
        .post('/admin/groups')
        .set(ADMIN_HEADERS)
        .send({ name: 'token-list-empty' })
      const res = await request(app.getHttpServer())
        .get(`/admin/groups/${grp.body.id}/tokens`)
        .set(ADMIN_HEADERS)
      expect(res.status).toBe(200)
      expect(res.body).toEqual([])
    })

    it('returns issued tokens for the group', async () => {
      const grp = await request(app.getHttpServer())
        .post('/admin/groups')
        .set(ADMIN_HEADERS)
        .send({ name: 'token-list-group' })
      const gid: string = grp.body.id
      await request(app.getHttpServer())
        .post(`/admin/groups/${gid}/tokens`)
        .set(ADMIN_HEADERS)
        .send({ name: 'list-token-a' })
      await request(app.getHttpServer())
        .post(`/admin/groups/${gid}/tokens`)
        .set(ADMIN_HEADERS)
        .send({ name: 'list-token-b' })

      const res = await request(app.getHttpServer())
        .get(`/admin/groups/${gid}/tokens`)
        .set(ADMIN_HEADERS)
      expect(res.status).toBe(200)
      expect(res.body).toHaveLength(2)
      expect(res.body.map((t: { name: string }) => t.name)).toEqual(
        expect.arrayContaining(['list-token-a', 'list-token-b']),
      )
      // JWT must NOT be in the list response
      expect(res.body[0]).not.toHaveProperty('jwt')
    })

    it('does not include tokens from other groups', async () => {
      const grpA = await request(app.getHttpServer())
        .post('/admin/groups')
        .set(ADMIN_HEADERS)
        .send({ name: 'isolation-a' })
      const grpB = await request(app.getHttpServer())
        .post('/admin/groups')
        .set(ADMIN_HEADERS)
        .send({ name: 'isolation-b' })
      await request(app.getHttpServer())
        .post(`/admin/groups/${grpA.body.id}/tokens`)
        .set(ADMIN_HEADERS)
        .send({ name: 'a-token' })

      const res = await request(app.getHttpServer())
        .get(`/admin/groups/${grpB.body.id}/tokens`)
        .set(ADMIN_HEADERS)
      expect(res.status).toBe(200)
      expect(res.body).toEqual([])
    })

    it('returns 404 for unknown group', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/groups/00000000-0000-0000-0000-000000000000/tokens')
        .set(ADMIN_HEADERS)
      expect(res.status).toBe(404)
    })
  })
})
