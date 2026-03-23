<h1 align="center">OAS Gateway</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/@tronsfey/oas-server"><img src="https://img.shields.io/npm/v/@tronsfey/oas-server?label=%40tronsfey%2Foas-server&color=7c3aed" alt="oas-server version"/></a>
  <a href="https://www.npmjs.com/package/@tronsfey/oas-cli"><img src="https://img.shields.io/npm/v/@tronsfey/oas-cli?label=%40tronsfey%2Foas-cli&color=2563eb" alt="oas-cli version"/></a>
  <img src="https://img.shields.io/badge/license-MIT-22c55e" alt="license"/>
  <img src="https://img.shields.io/badge/node-%3E%3D18-38bdf8" alt="node"/>
</p>

<p align="center">
  English | <a href="./README.zh.md">中文</a>
</p>

---

## What is OAS Gateway?

**OAS Gateway** is a centralized [OpenAPI Specification](https://swagger.io/specification/) management system built with a client/server architecture.

- The **server** (`@tronsfey/oas-server`) stores OpenAPI specs with **encrypted auth configs** (AES-256-GCM) and issues **group-scoped JWTs** (RS256).
- The **CLI** (`@tronsfey/oas-cli`) lets AI agents discover and invoke API operations **without ever seeing credentials** — auth is injected as environment variables at runtime.

## Architecture

```mermaid
graph TB
    subgraph Admin["🔐 Admin / DevOps"]
        ADM[curl / Admin Client]
    end

    subgraph Server["🖥️  @tronsfey/oas-server  ·  NestJS v11"]
        SVC["REST API\n(AdminGuard + GroupTokenGuard)"]
        ST[("Storage\nmemory · postgres · mysql")]
        CA[("Cache\nmemory · redis")]
        CR["Crypto\nAES-256-GCM · RS256 JWT"]
        SVC --- ST
        SVC --- CA
        SVC --- CR
    end

    subgraph Client["💻  @tronsfey/oas-cli  ·  Commander.js"]
        CLI[oas-cli]
        O2C["@tronsfey/openapi2cli\n(subprocess)"]
        CLI -->|"spawn with ENV creds"| O2C
    end

    subgraph APIs["🌐 Target APIs"]
        A1[Payments API]
        A2[Inventory API]
        A3["CRM / Other APIs"]
    end

    ADM -->|"X-Admin-Secret header"| SVC
    CLI -->|"Bearer JWT (group token)"| SVC
    SVC -.->|"OAS + decrypted auth  (TLS)"| CLI
    O2C -->|"HTTP + ENV-injected credentials"| A1
    O2C -->|"HTTP + ENV-injected credentials"| A2
    O2C -->|"HTTP + ENV-injected credentials"| A3
```

## Auth Flow

```mermaid
sequenceDiagram
    participant Admin
    participant Server as oas-server
    participant CLI as oas-cli
    participant API as Target API

    Admin->>Server: POST /admin/groups (X-Admin-Secret)
    Server-->>Admin: { groupId, name }

    Admin->>Server: POST /admin/groups/:id/tokens
    Server-->>Admin: JWT  ⚠️ shown once — store securely

    Admin->>Server: POST /admin/oas  { name, remoteUrl, authConfig }
    Server->>Server: Encrypt authConfig with AES-256-GCM
    Server-->>Admin: OAS entry created

    Note over CLI,Server: Later — agent runtime

    CLI->>Server: GET /api/v1/oas  (Bearer JWT)
    Server->>Server: Verify JWT · Decrypt authConfig
    Server-->>CLI: OAS spec + plain auth (TLS only)

    CLI->>CLI: Inject auth as ENV vars (never written to disk)
    CLI->>API: HTTP request via @tronsfey/openapi2cli subprocess
    API-->>CLI: Response (JSON / YAML / table)
```

## Repository Structure

```
fantastic-potato/
├── README.md                        # This file (English)
├── README.zh.md                     # Chinese docs
├── CLAUDE.md                        # AI assistant guidance
├── assets/
│   └── logo.svg                     # Brand logo
├── package.json                     # pnpm workspace root
├── tsconfig.base.json               # Shared TS config
├── docker-compose.yml               # PostgreSQL + Redis for local dev
└── packages/
    ├── server/                      # @tronsfey/oas-server (NestJS v11)
    │   ├── src/
    │   │   ├── auth/                # AdminGuard + GroupTokenGuard
    │   │   ├── cache/               # Pluggable cache (memory | redis)
    │   │   ├── config/              # Joi-validated env vars
    │   │   ├── crypto/              # JwtService (RS256) + EncryptionService (AES-256-GCM)
    │   │   ├── groups/              # Group management
    │   │   ├── health/              # Liveness + readiness probes
    │   │   ├── metrics/             # Prometheus export
    │   │   ├── oas/                 # OAS CRUD (admin + client)
    │   │   ├── storage/             # Pluggable storage (memory | postgres | mysql)
    │   │   └── tokens/              # Token issuance + revocation
    │   └── test/e2e/                # Jest E2E tests (memory adapters)
    └── cli/                         # @tronsfey/oas-cli (Commander.js + tsup/ESM)
        ├── src/
        │   ├── commands/            # configure, services, run, refresh, help
        │   └── lib/                 # server-client, cache, oas-runner
        └── test/                    # Vitest unit tests
```

## Quick Start

**Step 1 — Start the server**

```bash
npm install -g @tronsfey/oas-server

# Generate a 32-byte encryption key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

ADMIN_SECRET=my-secret ENCRYPTION_KEY=<64-hex> oas-server
# → Listening on http://localhost:3000
```

**Step 2 — Register a service and issue a token**

```bash
# Create a group
GROUP=$(curl -s -X POST http://localhost:3000/admin/groups \
  -H "X-Admin-Secret: my-secret" \
  -H "Content-Type: application/json" \
  -d '{"name":"agents"}' | jq -r '.id')

# Issue a JWT (save this — shown once!)
JWT=$(curl -s -X POST http://localhost:3000/admin/groups/$GROUP/tokens \
  -H "X-Admin-Secret: my-secret" \
  -H "Content-Type: application/json" \
  -d '{"name":"agent-token"}' | jq -r '.token')

# Register an OAS entry
curl -s -X POST http://localhost:3000/admin/oas \
  -H "X-Admin-Secret: my-secret" \
  -H "Content-Type: application/json" \
  -d "{
    \"groupId\": \"$GROUP\",
    \"name\": \"petstore\",
    \"remoteUrl\": \"https://petstore3.swagger.io/api/v3/openapi.json\",
    \"authType\": \"none\",
    \"authConfig\": {\"type\":\"none\"}
  }"
```

**Step 3 — Use the CLI**

```bash
npm install -g @tronsfey/oas-cli

oas-cli configure --server http://localhost:3000 --token $JWT
oas-cli services list
oas-cli run --service petstore --operation getPetById --params '{"petId": 1}'
```

## Packages

| Package | Description | Docs |
|---------|-------------|------|
| [`@tronsfey/oas-server`](./packages/server) | NestJS server — storage, crypto, auth, REST API, admin dashboard | [README](./packages/server/README.md) |
| [`@tronsfey/oas-cli`](./packages/cli) | Commander.js CLI — service discovery, operation runner | [README](./packages/cli/README.md) |
| `@tronsfey/oas-admin` *(private)* | React admin dashboard — bundled into `oas-server` at `/admin-ui` | — |

## Development

```bash
# Prerequisites: Node.js ≥ 18, pnpm ≥ 9
pnpm install

# Run all tests (no DB/Redis required — uses memory adapters)
pnpm test

# Type-check both packages
pnpm lint

# Start server in dev mode (hot-reload)
cd packages/server
ADMIN_SECRET=dev ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))") pnpm dev
```
