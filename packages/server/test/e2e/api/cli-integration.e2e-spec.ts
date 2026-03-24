import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createTestApp, ADMIN_HEADERS } from '../setup'

const execFileAsync = promisify(execFile)

interface CliResult {
  code: number
  stdout: string
  stderr: string
  signal?: string | null
  timedOut?: boolean
}

function runHttpMock(req: IncomingMessage, res: ServerResponse, baseUrl: string): void {
  const url = new URL(req.url ?? '/', baseUrl)

  if (req.method === 'GET' && url.pathname === '/openapi.json') {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({
      openapi: '3.0.0',
      info: { title: 'Mock API', version: '1.0.0' },
      servers: [{ url: baseUrl }],
      paths: {
        '/ping': {
          get: {
            operationId: 'getPing',
            'x-cli-name': 'getPing',
            parameters: [
              { name: 'name', in: 'query', schema: { type: 'string' }, required: false },
            ],
            responses: { 200: { description: 'ok' } },
          },
        },
      },
    }))
    return
  }

  if (req.method === 'GET' && url.pathname === '/ping') {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({
      ok: true,
      name: url.searchParams.get('name') ?? null,
    }))
    return
  }

  res.writeHead(404, { 'content-type': 'application/json' })
  res.end(JSON.stringify({ message: 'not found' }))
}

describe('CLI + Server integration (e2e)', () => {
  let app: INestApplication
  let serverUrl: string
  let token: string
  let mockServer: ReturnType<typeof createServer>
  let mockBaseUrl = ''
  let tempHome: string
  let mcpAllowedDir: string
  let cliDist: string
  let fsMcpBin: string

  const repoRoot = '/home/runner/work/ucli/ucli'

  async function runCli(args: string[]): Promise<CliResult> {
    try {
      const { stdout, stderr } = await execFileAsync(process.execPath, [cliDist, ...args], {
        cwd: repoRoot,
        timeout: 60000,
        env: {
          ...process.env,
          HOME: tempHome,
          XDG_CONFIG_HOME: join(tempHome, '.config'),
          XDG_CACHE_HOME: join(tempHome, '.cache'),
          NO_COLOR: '1',
        },
      })
      return { code: 0, stdout, stderr }
    } catch (err) {
      const e = err as { code?: number; stdout?: string; stderr?: string; signal?: string | null; killed?: boolean }
      return {
        code: e.code ?? 1,
        stdout: e.stdout ?? '',
        stderr: e.stderr ?? '',
        signal: e.signal ?? null,
        timedOut: e.killed === true && e.signal === 'SIGTERM',
      }
    }
  }

  beforeAll(async () => {
    jest.setTimeout(180000)
    app = await createTestApp()
    await app.listen(0, '127.0.0.1')
    const address = app.getHttpServer().address() as { port: number }
    serverUrl = `http://127.0.0.1:${address.port}`

    tempHome = await mkdtemp(join(tmpdir(), 'ucli-cli-e2e-home-'))
    await mkdir(join(tempHome, '.config'), { recursive: true })
    await mkdir(join(tempHome, '.cache'), { recursive: true })
    mcpAllowedDir = await mkdtemp(join(tmpdir(), 'ucli-mcp-fs-'))
    await writeFile(join(mcpAllowedDir, 'sample.txt'), 'hello', 'utf8')

    await execFileAsync('pnpm', ['--filter', '@tronsfey/ucli', 'build'], { cwd: repoRoot })
    cliDist = join(repoRoot, 'packages/cli/dist/index.js')
    fsMcpBin = require.resolve('@modelcontextprotocol/server-filesystem/dist/index.js', {
      paths: [join(repoRoot, 'packages/cli')],
    })

    mockServer = createServer((req, res) => runHttpMock(req, res, mockBaseUrl))
    await new Promise<void>((resolve) => mockServer.listen(0, '127.0.0.1', () => resolve()))
    const mockAddr = mockServer.address() as { port: number }
    mockBaseUrl = `http://127.0.0.1:${mockAddr.port}`

    const group = await request(app.getHttpServer())
      .post('/admin/groups')
      .set(ADMIN_HEADERS)
      .send({ name: `cli-e2e-group-${Date.now()}` })

    const issue = await request(app.getHttpServer())
      .post(`/admin/groups/${group.body.id}/tokens`)
      .set(ADMIN_HEADERS)
      .send({ name: 'cli-e2e-token' })

    token = issue.body.jwt

    await request(app.getHttpServer())
      .post('/admin/oas')
      .set(ADMIN_HEADERS)
      .send({
        groupId: group.body.id,
        name: 'demo',
        description: 'Mock service',
        remoteUrl: `${mockBaseUrl}/openapi.json`,
        authType: 'none',
        authConfig: { type: 'none' },
        cacheTtl: 60,
      })

    await request(app.getHttpServer())
      .post('/admin/mcp')
      .set(ADMIN_HEADERS)
      .send({
        groupId: group.body.id,
        name: 'filesystem-local',
        description: 'Filesystem MCP stdio',
        transport: 'stdio',
        command: `node ${fsMcpBin} ${mcpAllowedDir}`,
        authConfig: { type: 'none' },
      })
  })

  afterAll(async () => {
    await new Promise<void>((resolve) => mockServer.close(() => resolve()))
    await rm(mcpAllowedDir, { recursive: true, force: true })
    await rm(tempHome, { recursive: true, force: true })
    await app.close()
  })

  it('runs documented CLI commands against a real local server stack', async () => {
    const configure = await runCli(['configure', '--server', serverUrl, '--token', token])
    expect(configure.code).toBe(0)
    expect(configure.stdout).toContain('Configuration saved successfully')

    const servicesList = await runCli(['services', 'list', '--format', 'json'])
    expect(servicesList.code).toBe(0)
    expect(servicesList.stdout).toContain('"name": "demo"')

    const servicesListRefresh = await runCli(['services', 'list', '--refresh', '--format', 'json'])
    expect(servicesListRefresh.code).toBe(0)
    expect(servicesListRefresh.stdout).toContain('"name": "demo"')

    const servicesInfo = await runCli(['services', 'info', 'demo', '--format', 'json'])
    expect(servicesInfo.code).toBe(0)
    expect(servicesInfo.stdout).toContain('"name": "demo"')
    expect(servicesInfo.stdout).toContain('"operationsHelp"')

    const helpGeneral = await runCli(['help'])
    expect(helpGeneral.code).toBe(0)
    expect(helpGeneral.stdout).toContain('ucli — OpenAPI & MCP Gateway for AI Agents')

    const helpService = await runCli(['help', 'demo'])
    expect(helpService.code).toBe(0)
    expect(helpService.stdout).toContain('=== demo ===')

    const runCmd = await runCli([
      'run',
      '--service',
      'demo',
      '--operation',
      'getPing',
      '--params',
      '{"name":"alice"}',
      '--format',
      'json',
    ])
    expect(runCmd.code).toBe(0)
    expect(runCmd.stderr).not.toContain('Operation failed')

    const mcpList = await runCli(['mcp', 'list', '--format', 'json'])
    expect(mcpList.code).toBe(0)
    expect(mcpList.stdout).toContain('"name": "filesystem-local"')

    const mcpTools = await runCli(['mcp', 'tools', 'filesystem-local', '--format', 'json'])
    if (mcpTools.code !== 0) {
      throw new Error(`mcp tools exit=${mcpTools.code} signal=${mcpTools.signal ?? 'none'} timeout=${mcpTools.timedOut === true}\nstdout:\n${mcpTools.stdout}\nstderr:\n${mcpTools.stderr}`)
    }
    expect(mcpTools.code).toBe(0)
    expect(mcpTools.stdout).toContain('"name": "list_directory"')

    const mcpRun = await runCli(['mcp', 'run', 'filesystem-local', 'list_directory', `path=${mcpAllowedDir}`])
    expect(mcpRun.code).toBe(0)
    expect(`${mcpRun.stdout}\n${mcpRun.stderr}`).toContain('sample.txt')

    const refreshAll = await runCli(['refresh'])
    expect(refreshAll.code).toBe(0)
    expect(refreshAll.stdout).toContain('Refreshed 1 service(s)')

    const refreshOne = await runCli(['refresh', '--service', 'demo'])
    expect(refreshOne.code).toBe(0)
    expect(refreshOne.stdout).toContain('Refreshed 1 service(s)')
  }, 120000)
})
