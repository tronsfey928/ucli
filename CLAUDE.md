# CLAUDE.md

This file provides guidance for AI assistants (Claude and others) working in this repository.

## Project Overview

**Project name:** ucli (`fantastic-potato`)
**Purpose:** Centralized OpenAPI Specification and MCP Server management system with a C/S architecture. The server stores OAS entries and MCP server configs with encrypted auth configs and issues group JWTs; the CLI client enables AI agents to discover and invoke API operations and MCP tools without handling credentials directly.
**Primary language:** TypeScript (strict)
**Framework(s):** NestJS v11 (server), Commander.js (CLI)

---

## Repository Structure

```
fantastic-potato/
├── CLAUDE.md                        # This file — AI assistant guidance
├── package.json                     # pnpm workspace root
├── tsconfig.base.json               # Shared TypeScript config (CommonJS, decorators)
└── packages/
    ├── server/                      # @tronsfey/ucli-server (NestJS v11)
    │   ├── src/
    │   │   ├── main.ts              # NestJS bootstrap entry point
    │   │   ├── app.module.ts        # Root module
    │   │   ├── config/              # AppConfigModule (Joi-validated env vars)
    │   │   ├── storage/             # Pluggable storage (memory | postgres | mysql)
    │   │   │   ├── interfaces/      # IGroupRepo / ITokenRepo / IOASRepo / IMCPRepo
    │   │   │   ├── storage.tokens.ts # GROUP_REPO / TOKEN_REPO / OAS_REPO / MCP_REPO injection tokens
    │   │   │   ├── memory/          # In-memory repos (default, no DB required)
    │   │   │   └── typeorm/         # TypeORM repos + entities (PostgreSQL + MySQL)
    │   │   ├── cache/               # Pluggable cache (memory | redis)
    │   │   │   ├── cache.token.ts   # CACHE_ADAPTER injection token
    │   │   │   ├── memory/          # In-memory TTL cache
    │   │   │   └── redis/           # Redis (ioredis)
    │   │   ├── crypto/              # JwtService (RS256) + EncryptionService (AES-256-GCM)
    │   │   ├── auth/                # AdminGuard + GroupTokenGuard + @JwtPayload decorator
    │   │   ├── groups/              # POST/GET /admin/groups
    │   │   ├── tokens/              # POST /admin/groups/:id/tokens, DELETE /admin/tokens/:id
    │   │   ├── oas/                 # Admin + client OAS CRUD endpoints
    │   │   ├── mcp/                 # Admin + client MCP Server CRUD + proxy endpoints
    │   │   ├── health/              # /api/v1/health, /api/v1/ready (@nestjs/terminus)
    │   │   └── metrics/             # GET /metrics (Prometheus, prom-client)
    │   ├── test/e2e/                # Jest E2E tests (memory adapters, no external deps)
    │   │   ├── setup.ts             # createTestApp() factory + ADMIN_HEADERS
    │   │   ├── admin/               # groups, tokens, oas, mcp E2E specs
    │   │   ├── api/                 # client OAS + MCP E2E specs (group isolation)
    │   │   ├── health/              # health + ready probe spec
    │   │   └── auth/                # 401 scenarios, token revocation
    │   ├── jest.config.js
    │   ├── jest-e2e.config.js
    │   └── tsconfig.json
    ├── cli/                         # @tronsfey/ucli (Commander.js + tsup/ESM)
    │   ├── src/
    │   │   ├── index.ts             # CLI entry point
    │   │   ├── config.ts            # Conf-based local config store
    │   │   ├── commands/            # configure, listoas, listmcp, oas, mcp, refresh, help
    │   │   └── lib/
    │   │       ├── server-client.ts # Axios HTTP client for /api/v1/oas + /api/v1/mcp
    │   │       ├── cache.ts         # OS temp dir file cache with TTL
    │   │       ├── oas-runner.ts    # Spawns @tronsfey/openapi2cli with injected auth
    │   │       └── mcp-runner.ts    # Uses @tronsfey/mcp2cli programmatic API
    │   ├── test/                    # Vitest unit tests
    │   ├── skill.md                 # Anthropic skill definition for AI agents
    │   └── tsconfig.json
    └── admin/                       # @tronsfey/ucli-admin (private, bundled into server)
        ├── src/
        │   ├── main.tsx             # React 18 entry point
        │   ├── App.tsx              # Router + RequireAuth wrapper
        │   ├── index.css            # Tailwind + Remixicon + CSS variables
        │   ├── lib/
        │   │   ├── api.ts           # Axios client (timeout, 401 interceptor, helpers)
        │   │   ├── auth.ts          # sessionStorage auth store (key: ucli-admin-auth)
        │   │   └── utils.ts         # cn(), formatDate(), relativeTime()
        │   ├── components/
        │   │   ├── Layout.tsx       # Sidebar navigation
        │   │   └── ui/              # shadcn-style components (Radix UI primitives)
        │   └── pages/               # Login, Dashboard, Groups, OASPage, Tokens, MCPPage
        ├── vite.config.ts           # base: '/admin-ui/', proxy to :3000
        ├── tailwind.config.ts       # Tailwind v3 + CSS variable color system
        └── package.json             # private: true, not published independently
```

---

## Development Setup

### Prerequisites

- Node.js ≥ 18 (v22 recommended)
- pnpm ≥ 9

### Install

```bash
pnpm install
```

### Server — local development (no Docker, no DB/Redis)

```bash
cd packages/server
# Generate encryption key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

ADMIN_SECRET=dev-secret ENCRYPTION_KEY=<64-hex> pnpm dev
# Server starts on http://localhost:3000
```

### CLI — local development

```bash
cd packages/cli
pnpm build
node dist/index.js configure --server http://localhost:3000 --token <jwt>
node dist/index.js services list
```

### Environment Variables (server)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ADMIN_SECRET` | Yes | — | Secret for `X-Admin-Secret` header (≥8 chars) |
| `ENCRYPTION_KEY` | Yes | — | 64-char hex (32 bytes) for AES-256-GCM |
| `PORT` | No | `3000` | HTTP listen port |
| `HOST` | No | `0.0.0.0` | HTTP listen host |
| `DB_TYPE` | No | `memory` | `memory` \| `postgres` \| `mysql` |
| `DATABASE_URL` | If DB | — | PostgreSQL or MySQL connection string |
| `CACHE_TYPE` | No | `memory` | `memory` \| `redis` |
| `REDIS_URL` | If redis | — | Redis URL |
| `JWT_PRIVATE_KEY` | Prod | auto-gen | Base64 PKCS8 PEM |
| `JWT_PUBLIC_KEY` | Prod | auto-gen | Base64 SPKI PEM |
| `JWT_DEFAULT_TTL` | No | `86400` | Token TTL in seconds (0 = no expiry) |
| `LOG_LEVEL` | No | `info` | `trace\|debug\|info\|warn\|error\|fatal` |
| `OTEL_ENABLED` | No | `true` | Set `false` to disable OpenTelemetry tracing |
| `OTEL_SERVICE_NAME` | No | `ucli-server` | Service name on all trace spans |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | No | — | OTLP collector URL; unset = no-op exporter |
| `RATE_LIMIT_TTL` | No | `60000` | Rate limit window in milliseconds |
| `RATE_LIMIT_LIMIT` | No | `100` | Max requests per window per IP |
| `METRICS_ALLOWED_IPS` | No | `127.0.0.1,::1` | Comma-separated IPs allowed to scrape `/metrics` |
| `ADMIN_UI_PATH` | No | auto | Override path to admin dashboard static files |

---

## Build & Run

```bash
# Build all packages
pnpm build

# Server — development (hot-reload)
cd packages/server && pnpm dev

# Server — production
cd packages/server && pnpm build && pnpm start:prod

# CLI — production build
cd packages/cli && pnpm build
```

---

## Testing

```bash
# Run all tests (server E2E + CLI unit)
pnpm test

# Server E2E only (uses memory adapters — no DB/Redis required)
pnpm --filter @tronsfey/ucli-server test:e2e

# CLI unit tests only (Vitest)
pnpm --filter @tronsfey/ucli test

# Server with coverage
pnpm --filter @tronsfey/ucli-server test:coverage
```

E2E tests set `DB_TYPE=memory CACHE_TYPE=memory` in `packages/server/test/e2e/setup.ts` — no external dependencies required for testing.

### MANDATORY Pre-Push Rules (non-negotiable)

> These rules apply to every AI assistant and every human contributor. Violations must be reverted before the branch can be merged.

1. **`pnpm test` must pass (all tests, zero failures) before every `git push`.**
2. **`pnpm lint` must produce zero TypeScript errors before every `git push`.**
3. **Every new endpoint, feature, or behavioral change must include a corresponding E2E or unit test in the same commit.** Code without tests will not be merged.
4. **Every command example added to any README or documentation must be verified to run successfully in a local environment before committing.**
5. **All `ADMIN_SECRET` values in documentation examples must be ≥ 8 characters** (Joi enforces `min(8)` — shorter values will crash the server on startup).

---

## Linting & Formatting

```bash
# Type-check both packages
pnpm lint

# Per-package
pnpm --filter @tronsfey/ucli-server lint
pnpm --filter @tronsfey/ucli lint
```

Fix all TypeScript type errors before committing. No exceptions.

---

## Key Architecture Decisions

### Pluggable Storage (StorageModule)

`StorageModule.forRoot()` is a NestJS `DynamicModule` that reads `DB_TYPE` at startup:
- **memory**: `MemoryGroupRepo`, `MemoryTokenRepo`, `MemoryOASRepo`, `MemoryMCPRepo` (no external deps)
- **postgres / mysql**: TypeORM repositories with `GroupEntity`, `TokenEntity`, `OASEntryEntity`, `McpEntryEntity`

Injection tokens (`GROUP_REPO`, `TOKEN_REPO`, `OAS_REPO`, `MCP_REPO`) defined in `storage/storage.tokens.ts`.

### Pluggable Cache (CacheModule)

`CacheModule.forRoot()` reads `CACHE_TYPE`:
- **memory**: `MemoryCacheAdapter`
- **redis**: `RedisCacheAdapter` (ioredis)

Injection token: `CACHE_ADAPTER` (from `cache/cache.token.ts`).

### Auth Flow

1. Admin authenticates via `X-Admin-Secret` header (`AdminGuard`)
2. Admin creates groups and issues group JWTs via admin API
3. Clients authenticate via `Authorization: Bearer <jwt>` (`GroupTokenGuard`)
4. `GroupTokenGuard` verifies RS256 signature and checks JTI against cache revocation blacklist

### Auth Config Security

- Auth configs encrypted with AES-256-GCM before database storage
- Decrypted in memory only at request time; delivered to CLI over TLS
- CLI injects OAS credentials as env vars into `@tronsfey/openapi2cli` subprocess
- CLI injects MCP credentials as headers/env into `@tronsfey/mcp2cli` programmatic API
- Credentials are **never written to disk** or exposed as CLI args (visible in `ps`)

### TypeScript Config (tsconfig.base.json)

NestJS requires:
- `"module": "CommonJS"` (NestJS ESM support incomplete)
- `"experimentalDecorators": true`
- `"emitDecoratorMetadata": true`

The CLI uses `"type": "module"` (ESM) in its own `package.json` with `tsup` for bundling.

---

## API Reference

### Admin API (`X-Admin-Secret: <ADMIN_SECRET>`)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/admin/groups` | Create group |
| `GET` | `/admin/groups` | List groups |
| `POST` | `/admin/groups/:id/tokens` | Issue JWT for group |
| `GET` | `/admin/groups/:id/tokens` | List tokens for group (metadata only — JWTs not stored) |
| `DELETE` | `/admin/tokens/:id` | Revoke token |
| `POST` | `/admin/oas` | Register OAS entry |
| `GET` | `/admin/oas` | List all OAS entries |
| `PUT` | `/admin/oas/:id` | Update OAS entry |
| `DELETE` | `/admin/oas/:id` | Delete OAS entry |
| `POST` | `/admin/mcp` | Register MCP server |
| `GET` | `/admin/mcp` | List all MCP servers |
| `GET` | `/admin/mcp/:id` | Get MCP server by ID |
| `PUT` | `/admin/mcp/:id` | Update MCP server |
| `DELETE` | `/admin/mcp/:id` | Delete MCP server |

### Client API (`Authorization: Bearer <group-jwt>`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/oas` | List OAS entries for group |
| `GET` | `/api/v1/oas/:name` | Get single OAS entry (decrypted auth) |
| `GET` | `/api/v1/mcp` | List MCP servers for group (decrypted auth) |
| `GET` | `/api/v1/mcp/:name` | Get single MCP server (decrypted auth) |
| `GET` | `/api/v1/health` | Liveness probe (always 200) |
| `GET` | `/api/v1/ready` | Readiness probe (checks adapters) |
| `GET` | `/metrics` | Prometheus metrics (IP-restricted) |

---

## npm Publishing

Both packages are public and publishable:

```bash
# Dry-run to verify package contents
cd packages/server && npm pack --dry-run
cd packages/cli && npm pack --dry-run

# Publish
npm publish --workspace packages/server
npm publish --workspace packages/cli
```

---

## Git Workflow

### Branch naming

- Feature branches: `feature/<short-description>`
- Bug fixes: `fix/<short-description>`
- Documentation: `docs/<short-description>`
- AI-driven changes: `claude/<short-description>-<session-id>`

### Commit messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<optional scope>): <short summary>

[optional body]
```

Common types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`

---

## AI Assistant Guidelines

1. **Read before editing.** Always read a file fully before modifying it. Never guess at content.
2. **Minimal changes.** Only make changes directly requested or clearly necessary.
3. **No speculative abstractions.** Do not create helpers or patterns for hypothetical future needs.
4. **No backwards-compat shims.** If something is removed, delete it entirely.
5. **Never log auth_config in plaintext.** Auth configs are decrypted in memory only — never write to logs.
6. **No security vulnerabilities.** AES-256-GCM at rest, RS256 JWT, TLS in transit. Do not weaken these.
7. **CLI auth injection.** In `oas-runner.ts`, credentials are env vars to the child process — never CLI args. In `mcp-runner.ts`, credentials are passed via headers/env in `McpServerConfig` — never CLI args.
8. **Storage/cache pattern.** To add a new backend: implement the interface, add to the DynamicModule factory.
9. **Run tests before committing.** `pnpm test` must pass.
10. **Run lint before committing.** `pnpm lint` must produce no errors.
11. **Use the branch specified in the task.** Never push to a different branch without explicit permission.
12. **Update this file** when adding new conventions, tools, or workflows.
13. **Keep README docs in sync.** Whenever you modify APIs, CLI commands, env vars, architecture, or package versions, update the relevant README sections (`README.md`, `packages/server/README.md`, `packages/cli/README.md`) in the same commit.
