/**
 * screenshot.mjs — takes screenshots of all admin dashboard pages
 * Usage: node scripts/screenshot.mjs
 */
import pkg from '/opt/node22/lib/node_modules/playwright/index.js'
const { chromium } = pkg
import { mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '../docs/screenshots')
mkdirSync(OUT, { recursive: true })

const BASE_URL = 'http://localhost:13100'
const ADMIN_SECRET = 'screenshot-demo'
const ADMIN_UI = `${BASE_URL}/admin-ui`

async function delay(ms) {
  return new Promise(r => setTimeout(r, ms))
}

async function screenshot(page, name) {
  await delay(600)
  await page.screenshot({ path: join(OUT, name), fullPage: false })
  console.log(`  ✓ ${name}`)
}

async function run() {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1.5,
  })
  const page = await ctx.newPage()

  // ── 01-login.png ──────────────────────────────────────────────────────
  console.log('[1/10] Login page')
  await page.goto(`${ADMIN_UI}/login`, { waitUntil: 'networkidle' })
  // Fill in credentials
  await page.fill('input[placeholder*="http"]', BASE_URL)
  await page.fill('input[type="password"]', ADMIN_SECRET)
  await screenshot(page, '01-login.png')

  // ── Login ──────────────────────────────────────────────────────────────
  await page.click('button[type="submit"]')
  await page.waitForURL(`${ADMIN_UI}/dashboard`, { timeout: 8000 })
  await delay(800)

  // ── 02-dashboard.png ───────────────────────────────────────────────────
  console.log('[2/10] Dashboard')
  await page.waitForSelector('[data-testid="stat-card"], .stat-card, h2, .grid', { timeout: 5000 }).catch(() => {})
  await screenshot(page, '02-dashboard.png')

  // ── 03-groups.png ──────────────────────────────────────────────────────
  console.log('[3/10] Groups list')
  await page.goto(`${ADMIN_UI}/groups`, { waitUntil: 'networkidle' })
  await screenshot(page, '03-groups.png')

  // ── 04-groups-create.png ───────────────────────────────────────────────
  console.log('[4/10] Groups - create dialog')
  // Click the "New Group" / "+" button
  const newGroupBtn = page.locator('button').filter({ hasText: /new group|create|add|\+/i }).first()
  await newGroupBtn.click()
  await delay(400)
  await screenshot(page, '04-groups-create.png')
  // Close dialog with Escape
  await page.keyboard.press('Escape')
  await delay(300)

  // ── 05-oas.png ─────────────────────────────────────────────────────────
  console.log('[5/10] OAS entries list')
  await page.goto(`${ADMIN_UI}/oas`, { waitUntil: 'networkidle' })
  await screenshot(page, '05-oas.png')

  // ── 06-oas-edit.png ────────────────────────────────────────────────────
  console.log('[6/10] OAS - edit dialog')
  // Click first edit button (pencil icon or "Edit")
  const editBtn = page.locator('button[aria-label*="edit" i], button[title*="edit" i]').first()
    .or(page.locator('tbody tr').first().locator('button').nth(0))
  await editBtn.click()
  await delay(500)
  await screenshot(page, '06-oas-edit.png')
  await page.keyboard.press('Escape')
  await delay(300)

  // ── 07-mcp.png ─────────────────────────────────────────────────────────
  console.log('[7/10] MCP servers list')
  await page.goto(`${ADMIN_UI}/mcp`, { waitUntil: 'networkidle' })
  await screenshot(page, '07-mcp.png')

  // ── 08-mcp-create.png ──────────────────────────────────────────────────
  console.log('[8/10] MCP - create dialog')
  // Wait for groups to load (button becomes visible and enabled)
  await page.locator('button').filter({ hasText: /add mcp server/i }).first().waitFor({ timeout: 10000 })
  await delay(300)
  await page.locator('button').filter({ hasText: /add mcp server/i }).first().click({ force: true })
  await delay(500)
  await screenshot(page, '08-mcp-create.png')
  await page.keyboard.press('Escape')
  await delay(300)

  // ── 09-tokens.png ──────────────────────────────────────────────────────
  console.log('[9/10] Tokens list')
  await page.goto(`${ADMIN_UI}/tokens`, { waitUntil: 'networkidle' })
  // The page auto-selects the first group; wait for tokens to load
  await delay(800)
  await screenshot(page, '09-tokens.png')

  // ── 10-tokens-issued.png ───────────────────────────────────────────────
  console.log('[10/10] Tokens - issue dialog')
  const issueBtn = page.locator('button').filter({ hasText: /issue token/i }).first()
  await issueBtn.click()
  await delay(400)
  await screenshot(page, '10-tokens-issued.png')
  await page.keyboard.press('Escape')

  await browser.close()
  console.log(`\nAll screenshots saved to ${OUT}`)
}

run().catch(e => {
  console.error('Screenshot failed:', e.message)
  process.exit(1)
})
