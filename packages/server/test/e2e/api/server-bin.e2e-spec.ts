import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { execFile, type ChildProcess, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { createServer } from 'node:net'
import http from 'node:http'

const execFileAsync = promisify(execFile)

const repoRoot = join(process.cwd(), '..', '..')
const serverPkg = join(repoRoot, 'packages', 'server')

describe('Server binary (e2e)', () => {
  beforeAll(async () => {
    jest.setTimeout(120000)
    await execFileAsync('pnpm', ['--filter', '@tronsfey/ucli-server', 'build'], { cwd: repoRoot })
  }, 120000)

  it('dist/main.js starts with a Node.js shebang', async () => {
    const mainJs = join(serverPkg, 'dist', 'main.js')
    const content = await readFile(mainJs, 'utf8')
    expect(content.startsWith('#!/usr/bin/env node\n')).toBe(true)
  })

  it('dist/main.js is executable and the server can start and respond', async () => {
    const mainJs = join(serverPkg, 'dist', 'main.js')

    // Find an available port by briefly binding to port 0
    const port = await getFreePort()

    const child: ChildProcess = spawn(process.execPath, [mainJs], {
      cwd: serverPkg,
      env: {
        ...process.env,
        PORT: String(port),
        HOST: '127.0.0.1',
        ADMIN_SECRET: 'test-admin-secret-ok',
        ENCRYPTION_KEY: 'a'.repeat(64),
        DB_TYPE: 'memory',
        CACHE_TYPE: 'memory',
        LOG_LEVEL: 'error',
        OTEL_ENABLED: 'false',
        RATE_LIMIT_LIMIT: '1000',
        RATE_LIMIT_TTL: '60000',
        METRICS_ALLOWED_IPS: '127.0.0.1,::1,::ffff:127.0.0.1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    try {
      // Wait for the server to be ready by polling the health endpoint
      const isReady = await waitForServer(`http://127.0.0.1:${port}/api/v1/health`, 15000)
      expect(isReady).toBe(true)

      // Verify health endpoint responds correctly
      const healthRes = await httpGet(`http://127.0.0.1:${port}/api/v1/health`)
      const health = JSON.parse(healthRes)
      expect(health.status).toBe('ok')
    } finally {
      child.kill('SIGTERM')
      await Promise.race([
        new Promise<void>((resolve) => child.on('exit', () => resolve())),
        new Promise<void>((resolve) => setTimeout(resolve, 3000).unref()),
      ])
    }
  }, 30000)
})

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer()
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address()
      if (addr && typeof addr === 'object') {
        const port = addr.port
        srv.close(() => resolve(port))
      } else {
        srv.close(() => reject(new Error('Failed to get free port')))
      }
    })
    srv.on('error', reject)
  })
}

function httpGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = ''
      res.on('data', (chunk) => (data += chunk))
      res.on('end', () => resolve(data))
    }).on('error', reject)
  })
}

async function waitForServer(url: string, timeoutMs: number): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      await httpGet(url)
      return true
    } catch {
      await new Promise((r) => setTimeout(r, 200))
    }
  }
  return false
}
