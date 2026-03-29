import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import * as http from 'http'
import { createTestApp, ADMIN_HEADERS } from '../setup'

describe('Admin OAS Probe (e2e)', () => {
  let app: INestApplication
  let fakeServer: http.Server
  let fakePort: number

  beforeAll(async () => {
    app = await createTestApp()

    // Create a minimal HTTP server that serves an OpenAPI spec
    fakeServer = http.createServer((req, res) => {
      if (req.url === '/openapi.json') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          openapi: '3.0.0',
          info: { title: 'Test API', description: 'A test API', version: '1.0.0' },
          servers: [{ url: 'https://api.test.com' }],
          paths: {
            '/users': {
              get: { summary: 'List users', operationId: 'listUsers' },
              post: { summary: 'Create user', operationId: 'createUser' },
            },
            '/users/{id}': {
              get: { summary: 'Get user by ID', operationId: 'getUser' },
              delete: { summary: 'Delete user', operationId: 'deleteUser' },
            },
          },
        }))
      } else if (req.url === '/invalid.json') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end('not valid json {{{')
      } else {
        res.writeHead(404)
        res.end('Not found')
      }
    })

    await new Promise<void>((resolve) => {
      fakeServer.listen(0, '127.0.0.1', () => {
        const addr = fakeServer.address() as { port: number }
        fakePort = addr.port
        resolve()
      })
    })
  })

  afterAll(async () => {
    await app.close()
    await new Promise<void>((resolve) => fakeServer.close(() => resolve()))
  })

  it('POST /admin/oas/probe — parses valid OpenAPI spec', async () => {
    const res = await request(app.getHttpServer())
      .post('/admin/oas/probe')
      .set(ADMIN_HEADERS)
      .send({ url: `http://127.0.0.1:${fakePort}/openapi.json` })
      .expect(200)

    expect(res.body.title).toBe('Test API')
    expect(res.body.description).toBe('A test API')
    expect(res.body.version).toBe('1.0.0')
    expect(res.body.servers).toEqual(['https://api.test.com'])
    expect(res.body.endpoints).toHaveLength(4)
    expect(res.body.endpoints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: '/users', method: 'GET', operationId: 'listUsers' }),
        expect.objectContaining({ path: '/users', method: 'POST', operationId: 'createUser' }),
        expect.objectContaining({ path: '/users/{id}', method: 'GET', operationId: 'getUser' }),
        expect.objectContaining({ path: '/users/{id}', method: 'DELETE', operationId: 'deleteUser' }),
      ]),
    )
  })

  it('POST /admin/oas/probe — returns 400 for invalid JSON', async () => {
    await request(app.getHttpServer())
      .post('/admin/oas/probe')
      .set(ADMIN_HEADERS)
      .send({ url: `http://127.0.0.1:${fakePort}/invalid.json` })
      .expect(400)
  })

  it('POST /admin/oas/probe — returns 400 for HTTP error', async () => {
    await request(app.getHttpServer())
      .post('/admin/oas/probe')
      .set(ADMIN_HEADERS)
      .send({ url: `http://127.0.0.1:${fakePort}/not-found` })
      .expect(400)
  })

  it('POST /admin/oas/probe — requires admin auth', async () => {
    await request(app.getHttpServer())
      .post('/admin/oas/probe')
      .send({ url: `http://127.0.0.1:${fakePort}/openapi.json` })
      .expect(401)
  })
})
