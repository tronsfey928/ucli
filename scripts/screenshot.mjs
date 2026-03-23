/**
 * screenshot.mjs — takes 14 screenshots of the admin dashboard
 *   01-10: English, light mode
 *   11-12: English, dark mode
 *   13-14: Chinese (zh), light mode
 *
 * Usage: node scripts/screenshot.mjs
 * Requires the server to be running: ucli-server (or pnpm dev in packages/server)
 */
import pkg from '/opt/node22/lib/node_modules/playwright/index.js'
const { chromium } = pkg
import { mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '../docs/screenshots')
mkdirSync(OUT, { recursive: true })

const BASE_URL = 'http://localhost:3000'
const ADMIN_SECRET = 'my-secret-key'
const ADMIN_UI = `${BASE_URL}/admin-ui`

// ── Seed mock data via admin API ─────────────────────────────────────────────
async function seedData() {
  const headers = { 'Content-Type': 'application/json', 'X-Admin-Secret': ADMIN_SECRET }
  const h = (body) => ({ method: 'POST', headers, body: JSON.stringify(body) })

  // Create groups
  const grpA = await fetch(`${BASE_URL}/admin/groups`, h({ name: 'production', description: 'Production agents' })).then(r => r.json())
  const grpB = await fetch(`${BASE_URL}/admin/groups`, h({ name: 'staging', description: 'Staging / QA environment' })).then(r => r.json())

  // Create OAS entries
  await fetch(`${BASE_URL}/admin/oas`, h({
    groupId: grpA.id, name: 'payments-api', description: 'Payment processing service',
    remoteUrl: 'https://api.example.com/payments/openapi.json',
    authType: 'bearer', authConfig: { type: 'bearer', token: 'sk-prod-xxxx' }, cacheTtl: 3600,
  }))
  await fetch(`${BASE_URL}/admin/oas`, h({
    groupId: grpA.id, name: 'user-service', description: 'User management & auth',
    remoteUrl: 'https://api.example.com/users/openapi.json',
    authType: 'api_key', authConfig: { type: 'api_key', key: 'key-abc123', in: 'header', name: 'X-API-Key' }, cacheTtl: 7200,
  }))
  await fetch(`${BASE_URL}/admin/oas`, h({
    groupId: grpB.id, name: 'inventory-svc', description: 'Inventory and stock tracking',
    remoteUrl: 'https://staging.example.com/inventory/openapi.json',
    authType: 'basic', authConfig: { type: 'basic', username: 'admin', password: 'pass' }, cacheTtl: 1800,
  }))

  // Create MCP servers
  await fetch(`${BASE_URL}/admin/mcp`, h({
    groupId: grpA.id, name: 'github-mcp', description: 'GitHub tools via MCP',
    transport: 'http', serverUrl: 'https://mcp.github.com/sse',
    authConfig: { type: 'http_headers', headers: { Authorization: 'Bearer ghp_xxxx' } },
  }))
  await fetch(`${BASE_URL}/admin/mcp`, h({
    groupId: grpA.id, name: 'filesystem-mcp', description: 'Local filesystem access',
    transport: 'stdio', command: 'npx -y @modelcontextprotocol/server-filesystem /tmp',
    authConfig: { type: 'none' },
  }))
  await fetch(`${BASE_URL}/admin/mcp`, h({
    groupId: grpB.id, name: 'search-mcp', description: 'Web search integration',
    transport: 'http', serverUrl: 'https://search-mcp.staging.example.com/sse',
    authConfig: { type: 'http_headers', headers: { 'X-API-Key': 'search-key-xyz' } },
  }))

  // Issue tokens
  await fetch(`${BASE_URL}/admin/groups/${grpA.id}/tokens`, h({ name: 'agent-prod-01', ttlSec: 2592000 }))
  await fetch(`${BASE_URL}/admin/groups/${grpA.id}/tokens`, h({ name: 'agent-prod-02', ttlSec: 86400 }))
  await fetch(`${BASE_URL}/admin/groups/${grpB.id}/tokens`, h({ name: 'staging-agent', ttlSec: 3600 }))

  console.log('  ✓ Mock data seeded')
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function delay(ms) {
  return new Promise(r => setTimeout(r, ms))
}

async function screenshot(page, name) {
  await delay(600)
  await page.screenshot({ path: join(OUT, name), fullPage: false })
  console.log(`  ✓ ${name}`)
}

async function login(page) {
  await page.goto(`${ADMIN_UI}/login`, { waitUntil: 'networkidle' })
  await page.fill('input[placeholder*="http"]', BASE_URL)
  await page.fill('input[type="password"]', ADMIN_SECRET)
  await page.click('button[type="submit"]')
  await page.waitForURL(`${ADMIN_UI}/dashboard`, { timeout: 10000 })
  await delay(600)
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function run() {
  console.log('Seeding mock data…')
  await seedData()

  const browser = await chromium.launch({ headless: true })

  // ════════════════════════════════════════════════════════════
  // PASS 1 — English, Light (01-10)
  // ════════════════════════════════════════════════════════════
  console.log('\n[Pass 1] English · Light (01–10)')
  {
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1.5,
    })
    // Pre-set locale + theme
    await ctx.addInitScript(() => {
      localStorage.setItem('ucli-lang', 'en')
      localStorage.setItem('ucli-theme', 'light')
    })
    const page = await ctx.newPage()

    // 01-login
    console.log('[1/14] Login')
    await page.goto(`${ADMIN_UI}/login`, { waitUntil: 'networkidle' })
    await page.fill('input[placeholder*="http"]', BASE_URL)
    await page.fill('input[type="password"]', ADMIN_SECRET)
    await screenshot(page, '01-login.png')

    await page.click('button[type="submit"]')
    await page.waitForURL(`${ADMIN_UI}/dashboard`, { timeout: 10000 })
    await delay(800)

    // 02-dashboard
    console.log('[2/14] Dashboard')
    await screenshot(page, '02-dashboard.png')

    // 03-groups
    console.log('[3/14] Groups list')
    await page.goto(`${ADMIN_UI}/groups`, { waitUntil: 'networkidle' })
    await screenshot(page, '03-groups.png')

    // 04-groups-create
    console.log('[4/14] Groups – create dialog')
    await page.locator('button').filter({ hasText: /new group/i }).first().click()
    await delay(400)
    await screenshot(page, '04-groups-create.png')
    await page.keyboard.press('Escape')
    await delay(300)

    // 05-oas
    console.log('[5/14] OAS entries')
    await page.goto(`${ADMIN_UI}/oas`, { waitUntil: 'networkidle' })
    await screenshot(page, '05-oas.png')

    // 06-oas-edit
    console.log('[6/14] OAS – edit dialog')
    await page.locator('tbody tr').first().locator('button').nth(0).click()
    await delay(500)
    await screenshot(page, '06-oas-edit.png')
    await page.keyboard.press('Escape')
    await delay(300)

    // 07-mcp
    console.log('[7/14] MCP servers')
    await page.goto(`${ADMIN_UI}/mcp`, { waitUntil: 'networkidle' })
    await screenshot(page, '07-mcp.png')

    // 08-mcp-create
    console.log('[8/14] MCP – create dialog')
    await page.locator('button').filter({ hasText: /add mcp server/i }).first().waitFor({ timeout: 10000 })
    await delay(300)
    await page.locator('button').filter({ hasText: /add mcp server/i }).first().click({ force: true })
    await delay(500)
    await screenshot(page, '08-mcp-create.png')
    await page.keyboard.press('Escape')
    await delay(300)

    // 09-tokens
    console.log('[9/14] Tokens list')
    await page.goto(`${ADMIN_UI}/tokens`, { waitUntil: 'networkidle' })
    await delay(800)
    await screenshot(page, '09-tokens.png')

    // 10-tokens-issue
    console.log('[10/14] Tokens – issue dialog')
    await page.locator('button').filter({ hasText: /issue token/i }).first().click()
    await delay(400)
    await screenshot(page, '10-tokens-issued.png')
    await page.keyboard.press('Escape')

    await ctx.close()
  }

  // ════════════════════════════════════════════════════════════
  // PASS 2 — English, Dark (11-12)
  // ════════════════════════════════════════════════════════════
  console.log('\n[Pass 2] English · Dark (11–12)')
  {
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1.5,
    })
    await ctx.addInitScript(() => {
      localStorage.setItem('ucli-lang', 'en')
      localStorage.setItem('ucli-theme', 'dark')
    })
    const page = await ctx.newPage()
    await login(page)

    // 11-dashboard-dark
    console.log('[11/14] Dashboard (dark)')
    await screenshot(page, '11-dashboard-dark.png')

    // 12-oas-dark
    console.log('[12/14] OAS entries (dark)')
    await page.goto(`${ADMIN_UI}/oas`, { waitUntil: 'networkidle' })
    await screenshot(page, '12-oas-dark.png')

    await ctx.close()
  }

  // ════════════════════════════════════════════════════════════
  // PASS 3 — Chinese, Light (13-14)
  // ════════════════════════════════════════════════════════════
  console.log('\n[Pass 3] Chinese · Light (13–14)')
  {
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1.5,
    })
    await ctx.addInitScript(() => {
      localStorage.setItem('ucli-lang', 'zh')
      localStorage.setItem('ucli-theme', 'light')
    })
    const page = await ctx.newPage()
    await login(page)

    // 13-dashboard-zh
    console.log('[13/14] Dashboard (Chinese)')
    await screenshot(page, '13-dashboard-zh.png')

    // 14-mcp-zh
    console.log('[14/14] MCP servers (Chinese)')
    await page.goto(`${ADMIN_UI}/mcp`, { waitUntil: 'networkidle' })
    await screenshot(page, '14-mcp-zh.png')

    await ctx.close()
  }

  await browser.close()
  console.log(`\nAll 14 screenshots saved to ${OUT}`)
}

run().catch(e => {
  console.error('Screenshot failed:', e.message, e.stack)
  process.exit(1)
})
