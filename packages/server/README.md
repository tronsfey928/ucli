<h1 align="center">ucli server</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/@tronsfey/ucli-server"><img src="https://img.shields.io/npm/v/@tronsfey/ucli-server?color=7c3aed" alt="npm version"/></a>
  <img src="https://img.shields.io/badge/NestJS-v11-e0234e" alt="NestJS"/>
  <img src="https://img.shields.io/badge/node-%3E%3D18-38bdf8" alt="node"/>
  <img src="https://img.shields.io/badge/license-MIT-22c55e" alt="license"/>
</p>

<p align="center">
  English | <a href="./README.zh.md">中文</a>
</p>

---

## Overview

`@tronsfey/ucli-server` is the server component of ucli. It provides:

- **Encrypted OAS storage** — OpenAPI specs with auth configs encrypted at rest (AES-256-GCM)
- **Encrypted MCP server storage** — MCP server configs with auth (none / http_headers / env) encrypted at rest
- **Group-scoped JWT issuance** — RS256-signed tokens that control which specs a client can access
- **Token revocation** — blacklist via cache (JTI-based)
- **Pluggable backends** — swap storage (memory / PostgreSQL / MySQL) and cache (memory / Redis) via env vars
- **Observability** — structured JSON logging (Pino), Prometheus metrics, health/readiness probes
- **Distributed tracing** — OpenTelemetry auto-instrumentation (HTTP, Express, PG, Redis) enabled by default

## Architecture

```mermaid
graph TB
    subgraph AppModule["AppModule"]
        direction TB
        Config["ConfigModule\n(Joi-validated env)"]
        Auth["AuthModule\nAdminGuard · GroupTokenGuard"]
        Crypto["CryptoModule\nJwtService (RS256)\nEncryptionService (AES-256-GCM)"]

        subgraph Storage["StorageModule.forRoot()"]
            Mem1["MemoryGroupRepo\nMemoryTokenRepo\nMemoryOASRepo\nMemoryMCPRepo"]
            DB1["TypeORM repos\n(postgres · mysql)"]
        end

        subgraph Cache["CacheModule.forRoot()"]
            Mem2["MemoryCacheAdapter"]
            Redis["RedisCacheAdapter\n(ioredis)"]
        end

        Groups["GroupsModule\nPOST/GET /admin/groups"]
        Tokens["TokensModule\nPOST /admin/groups/:id/tokens\nDELETE /admin/tokens/:id"]
        OAS["OASModule\nAdmin CRUD + Client read"]
        MCP["MCPModule\nAdmin CRUD + Client read"]
        Health["HealthModule\n/api/v1/health · /api/v1/ready"]
        Metrics["MetricsModule\nGET /metrics (Prometheus)"]
    end

    Config --> Auth
    Config --> Storage
    Config --> Cache
    Crypto --> Tokens
    Crypto --> OAS
    Storage --> Groups
    Storage --> Tokens
    Storage --> OAS
    Storage --> MCP
    Cache --> Auth
    Groups --> Tokens
    Groups --> OAS
    Crypto --> MCP
```

## Installation

```bash
npm install -g @tronsfey/ucli-server
# or
pnpm add -g @tronsfey/ucli-server
```

## Quick Start (memory mode — no DB/Redis required)

```bash
# 1. Generate a 32-byte encryption key
ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

# 2. Start the server
ADMIN_SECRET=my-secret ENCRYPTION_KEY=$ENCRYPTION_KEY ucli-server

# Server starts on http://localhost:3000
# Swagger UI: http://localhost:3000/api/docs
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ADMIN_SECRET` | **Yes** | — | Secret for `X-Admin-Secret` header (≥ 8 chars) |
| `ENCRYPTION_KEY` | **Yes** | — | 64-char hex (32 bytes) for AES-256-GCM |
| `PORT` | No | `3000` | HTTP listen port |
| `HOST` | No | `0.0.0.0` | HTTP listen host |
| `DB_TYPE` | No | `memory` | `memory` \| `postgres` \| `mysql` |
| `DATABASE_URL` | If DB | — | PostgreSQL or MySQL connection URL |
| `CACHE_TYPE` | No | `memory` | `memory` \| `redis` |
| `REDIS_URL` | If redis | — | Redis connection URL |
| `JWT_PRIVATE_KEY` | Prod | auto-gen | Base64-encoded PKCS8 PEM |
| `JWT_PUBLIC_KEY` | Prod | auto-gen | Base64-encoded SPKI PEM |
| `JWT_DEFAULT_TTL` | No | `86400` | Token TTL in seconds (`0` = no expiry) |
| `LOG_LEVEL` | No | `info` | `trace` \| `debug` \| `info` \| `warn` \| `error` \| `fatal` |
| `SWAGGER_ENABLED` | No | `true` | Set `false` to disable `/api/docs` in production |
| `OTEL_ENABLED` | No | `true` | Set `false` to disable OpenTelemetry tracing |
| `OTEL_SERVICE_NAME` | No | `ucli-server` | Service name on all trace spans |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | No | — | OTLP collector URL; unset = no-op exporter |
| `ADMIN_UI_PATH` | No | auto | Override path to admin dashboard static files |

## Storage Backends

| `DB_TYPE` | Driver | Notes |
|-----------|--------|-------|
| `memory` | — | Default. No persistence. Data lost on restart. |
| `postgres` | `pg` | PostgreSQL 13+ |
| `mysql` | `mysql2` | MySQL 5.7+ / MariaDB 10.3+ |

In **development** (`NODE_ENV != production`), TypeORM `synchronize: true` creates tables automatically.

In **production**, initialize the schema manually using the provided SQL files:

```bash
# PostgreSQL
psql -U oas_gateway -d oas_gateway -f packages/server/db/init.postgres.sql

# MySQL
mysql -u<user> -p<password> oas_gateway < packages/server/db/init.mysql.sql
```

Then start the server:

```bash
# PostgreSQL
DB_TYPE=postgres \
DATABASE_URL=postgresql://user:pass@host:5432/oas_gateway \
ADMIN_SECRET=secret ENCRYPTION_KEY=<64-hex> ucli-server

# MySQL
DB_TYPE=mysql \
DATABASE_URL=mysql://user:pass@host:3306/oas_gateway \
ADMIN_SECRET=secret ENCRYPTION_KEY=<64-hex> ucli-server
```

## Cache Backends

| `CACHE_TYPE` | Notes |
|--------------|-------|
| `memory` | Default. In-process TTL cache. Lost on restart. |
| `redis` | Redis 6+ via ioredis. Shared across multiple instances. |

```bash
CACHE_TYPE=redis REDIS_URL=redis://:password@host:6379 \
ADMIN_SECRET=secret ENCRYPTION_KEY=<64-hex> ucli-server
```

## Production Deployment

Generate persistent RS256 key pair so tokens survive restarts:

```bash
node -e "
const { generateKeyPairSync } = require('crypto');
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
console.log('JWT_PRIVATE_KEY=' + Buffer.from(privateKey.export({ type:'pkcs8', format:'pem' })).toString('base64'));
console.log('JWT_PUBLIC_KEY=' + Buffer.from(publicKey.export({ type:'spki', format:'pem' })).toString('base64'));
"
```

Using `docker-compose.yml` in the repo root to spin up PostgreSQL + Redis:

```bash
docker-compose up -d
DB_TYPE=postgres CACHE_TYPE=redis \
DATABASE_URL=postgresql://oas_gateway:changeme@localhost:5432/oas_gateway \
REDIS_URL=redis://:changeme@localhost:6379 \
JWT_PRIVATE_KEY=<base64-pem> JWT_PUBLIC_KEY=<base64-pem> \
ADMIN_SECRET=<strong-secret> ENCRYPTION_KEY=<64-hex> \
ucli-server
```

## Admin API Reference

All admin endpoints require the `X-Admin-Secret: <ADMIN_SECRET>` header.

### Groups

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/admin/groups` | Create a group |
| `GET` | `/admin/groups` | List all groups |

```bash
# Create group
curl -X POST http://localhost:3000/admin/groups \
  -H "X-Admin-Secret: my-secret" \
  -H "Content-Type: application/json" \
  -d '{"name":"production","description":"Production agents group"}'
# → { "id": "uuid", "name": "production", "description": "..." }

# List groups
curl http://localhost:3000/admin/groups \
  -H "X-Admin-Secret: my-secret"
```

### Tokens

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/admin/groups/:id/tokens` | Issue a JWT for the group |
| `DELETE` | `/admin/tokens/:id` | Revoke a token |

```bash
# Issue token (save the returned JWT — shown once!)
curl -X POST http://localhost:3000/admin/groups/<group-id>/tokens \
  -H "X-Admin-Secret: my-secret" \
  -H "Content-Type: application/json" \
  -d '{"name":"agent-token","ttlSec":86400}'
# → { "id": "jti-uuid", "token": "eyJ..." }

# Revoke token
curl -X DELETE http://localhost:3000/admin/tokens/<jti-uuid> \
  -H "X-Admin-Secret: my-secret"
```

### OAS Entries

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/admin/oas` | Register an OAS entry |
| `GET` | `/admin/oas` | List all OAS entries |
| `PUT` | `/admin/oas/:id` | Update an OAS entry |
| `DELETE` | `/admin/oas/:id` | Delete an OAS entry |

```bash
# Register
curl -X POST http://localhost:3000/admin/oas \
  -H "X-Admin-Secret: my-secret" \
  -H "Content-Type: application/json" \
  -d '{
    "groupId": "<group-id>",
    "name": "payments",
    "remoteUrl": "https://api.example.com/openapi.json",
    "authType": "bearer",
    "authConfig": {"type":"bearer","token":"<api-token>"},
    "cacheTtl": 3600
  }'

# List
curl http://localhost:3000/admin/oas \
  -H "X-Admin-Secret: my-secret"

# Update
curl -X PUT http://localhost:3000/admin/oas/<oas-id> \
  -H "X-Admin-Secret: my-secret" \
  -H "Content-Type: application/json" \
  -d '{"cacheTtl": 7200}'

# Delete
curl -X DELETE http://localhost:3000/admin/oas/<oas-id> \
  -H "X-Admin-Secret: my-secret"
```

### MCP Servers

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/admin/mcp` | Register an MCP server |
| `GET` | `/admin/mcp` | List all MCP servers |
| `GET` | `/admin/mcp/:id` | Get a single MCP server |
| `PUT` | `/admin/mcp/:id` | Update an MCP server |
| `DELETE` | `/admin/mcp/:id` | Delete an MCP server |

```bash
# Register (http transport + no auth)
curl -X POST http://localhost:3000/admin/mcp \
  -H "X-Admin-Secret: my-secret" \
  -H "Content-Type: application/json" \
  -d '{
    "groupId": "<group-id>",
    "name": "weather",
    "transport": "http",
    "serverUrl": "https://weather.mcp.example.com/sse",
    "authConfig": {"type":"none"}
  }'

# Register (stdio transport + env auth)
curl -X POST http://localhost:3000/admin/mcp \
  -H "X-Admin-Secret: my-secret" \
  -H "Content-Type: application/json" \
  -d '{
    "groupId": "<group-id>",
    "name": "local-tools",
    "transport": "stdio",
    "command": "npx -y @myorg/mcp-tools",
    "authConfig": {"type":"env","env":{"API_KEY":"<secret>","REGION":"us-east-1"}}
  }'

# List
curl http://localhost:3000/admin/mcp \
  -H "X-Admin-Secret: my-secret"

# Update
curl -X PUT http://localhost:3000/admin/mcp/<mcp-id> \
  -H "X-Admin-Secret: my-secret" \
  -H "Content-Type: application/json" \
  -d '{"description": "Updated description"}'

# Delete
curl -X DELETE http://localhost:3000/admin/mcp/<mcp-id> \
  -H "X-Admin-Secret: my-secret"
```

---

## Client API Reference

Client endpoints require `Authorization: Bearer <group-jwt>`.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/oas` | List OAS entries visible to the token's group |
| `GET` | `/api/v1/oas/:name` | Get a single OAS entry with decrypted auth |
| `GET` | `/api/v1/mcp` | List MCP servers for the token's group (decrypted auth) |
| `GET` | `/api/v1/mcp/:name` | Get a single MCP server with decrypted auth |

## Auth Types

| `authType` | `authConfig` shape |
|------------|-------------------|
| `none` | `{ "type": "none" }` |
| `bearer` | `{ "type": "bearer", "token": "..." }` |
| `api_key` | `{ "type": "api_key", "key": "...", "in": "header\|query", "name": "X-API-Key" }` |
| `basic` | `{ "type": "basic", "username": "...", "password": "..." }` |
| `oauth2_cc` | `{ "type": "oauth2_cc", "tokenUrl": "...", "clientId": "...", "clientSecret": "...", "scopes": [] }` |

Auth configs are encrypted with AES-256-GCM before storage. They are decrypted in-memory only at request time.

## MCP Auth Types

| `authConfig.type` | Shape |
|--------------------|-------|
| `none` | `{ "type": "none" }` |
| `http_headers` | `{ "type": "http_headers", "headers": { "Authorization": "Bearer ..." } }` |
| `env` | `{ "type": "env", "env": { "API_KEY": "..." } }` (stdio transport) |

MCP auth configs follow the same encryption model as OAS auth configs: AES-256-GCM at rest, decrypted in-memory at request time.

## OpenTelemetry Tracing

Distributed tracing is **enabled by default**. The OTEL SDK auto-instruments HTTP, Express, PostgreSQL, and Redis without any code changes.

### How it coexists with Prometheus

| Concern | Technology | Endpoint |
|---------|-----------|---------|
| Metrics (scraping) | `prom-client` | `GET /metrics` |
| Distributed traces | OpenTelemetry | OTLP push to collector |

They are independent — no conflict. Prometheus scrapes `/metrics` as usual; OTEL exports spans to your collector via OTLP.

### OTEL environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OTEL_ENABLED` | `true` | Set `false` to disable entirely |
| `OTEL_SERVICE_NAME` | `ucli-server` | Service name tag on all spans |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | — | Collector URL (e.g. `http://otel-collector:4318`). When unset, spans are discarded locally (no-op) |
| `OTEL_EXPORTER_OTLP_HEADERS` | — | Auth headers for the collector (e.g. `Authorization=Bearer token`) |
| `OTEL_PROPAGATORS` | `tracecontext,baggage` | W3C trace context propagation (standard) |
| `OTEL_TRACES_SAMPLER` | `parentbased_always_on` | Sampling strategy |

### Quick setup with a local collector (docker)

```bash
# Start Jaeger all-in-one (OTLP + UI)
docker run -d --name jaeger \
  -p 4318:4318 \
  -p 16686:16686 \
  jaegertracing/all-in-one:latest

# Start ucli-server with tracing enabled
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318 \
ADMIN_SECRET=my-secret ENCRYPTION_KEY=<64-hex> ucli-server

# Open Jaeger UI
open http://localhost:16686
```

### Disabling OTEL

```bash
OTEL_ENABLED=false ADMIN_SECRET=my-secret ENCRYPTION_KEY=<64-hex> ucli-server
```

## Admin Dashboard

A built-in web UI is served at `/admin-ui` when the package is installed. It provides:

- **Dashboard** — overview stats (groups, OAS entries, MCP servers, active tokens)
- **Groups** — create and delete groups
- **OAS Entries** — register, edit, and delete OAS entries with auth configuration
- **MCP Servers** — register, edit, and delete MCP server configs with auth configuration
- **Tokens** — issue JWT tokens per group (shown once after creation), view status, revoke

The dashboard is auto-served from the `dist/admin-ui/` directory bundled with the npm package.
No extra configuration is required — just start the server and open `http://localhost:3000/admin-ui`.

The UI supports **English and Simplified Chinese** (toggle in sidebar) and **light / dark theme** (toggle in sidebar).

For full screenshots and feature details, see [`packages/admin/README.md`](../../packages/admin/README.md).

You can also point it at an existing dist directory:

```bash
ADMIN_UI_PATH=/path/to/custom/dist ADMIN_SECRET=secret ENCRYPTION_KEY=<64-hex> ucli-server
```

## Health & Observability

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/health` | `GET` | Liveness probe — always `200 OK` |
| `/api/v1/ready` | `GET` | Readiness probe — checks storage + cache adapters |
| `/metrics` | `GET` | Prometheus metrics (IP-restricted by default) |
| `/api/docs` | `GET` | Swagger UI (disable with `SWAGGER_ENABLED=false`) |
| `/api/openapi.json` | `GET` | OpenAPI 3.0 JSON spec |
| `/admin-ui` | `GET` | Admin dashboard |

## Security Model

- **At rest**: `authConfig` fields are encrypted with AES-256-GCM (256-bit key, random IV per record)
- **In transit**: Decrypted auth is only sent to authenticated CLI clients over TLS
- **JWT**: RS256-signed, JTI-tracked for revocation via cache blacklist
- **Admin auth**: `X-Admin-Secret` header checked via constant-time comparison
- **Never logged**: Auth configs are never written to logs or exposed in error messages
