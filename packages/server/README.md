# @oas-gateway/server

Centralized OpenAPI Specification management server. Issues group JWTs, stores OAS entries with encrypted auth configs, and exposes a REST API for the `oas-cli` client.

## Quick Start

```bash
# Install globally
npm install -g @oas-gateway/server

# Generate encryption key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Configure and start (memory mode — no DB/Redis required)
ADMIN_SECRET=my-secret \
ENCRYPTION_KEY=<64-hex> \
oas-server
```

Server starts on `http://localhost:3000` by default.

## Database Support

| `DB_TYPE` | Driver | Notes |
|-----------|--------|-------|
| `memory` | — | Default. Data lost on restart. |
| `postgres` | `pg` | PostgreSQL 12+ |
| `mysql` | `mysql2` | MySQL 5.7+ / MariaDB 10.3+ |

```bash
# PostgreSQL
DB_TYPE=postgres \
DATABASE_URL=postgresql://user:pass@host:5432/oas_gateway \
ADMIN_SECRET=secret \
ENCRYPTION_KEY=<64-hex> \
oas-server

# MySQL
DB_TYPE=mysql \
DATABASE_URL=mysql://user:pass@host:3306/oas_gateway \
ADMIN_SECRET=secret \
ENCRYPTION_KEY=<64-hex> \
oas-server
```

Tables are created automatically on first run (`synchronize: true` in dev, migrations in prod).

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ADMIN_SECRET` | Yes | — | Secret for `X-Admin-Secret` header (≥8 chars) |
| `ENCRYPTION_KEY` | Yes | — | 64-char hex (32 bytes) for AES-256-GCM |
| `PORT` | No | `3000` | HTTP listen port |
| `HOST` | No | `0.0.0.0` | HTTP listen host |
| `DB_TYPE` | No | `memory` | `memory` \| `postgres` \| `mysql` |
| `DATABASE_URL` | If DB | — | Connection URL |
| `CACHE_TYPE` | No | `memory` | `memory` \| `redis` |
| `REDIS_URL` | If redis | — | Redis connection URL |
| `JWT_PRIVATE_KEY` | Prod | auto-gen | Base64-encoded PKCS8 PEM |
| `JWT_PUBLIC_KEY` | Prod | auto-gen | Base64-encoded SPKI PEM |
| `JWT_DEFAULT_TTL` | No | `86400` | Token TTL in seconds (0 = no expiry) |
| `LOG_LEVEL` | No | `info` | `trace\|debug\|info\|warn\|error\|fatal` |

## Admin API

All admin endpoints require `X-Admin-Secret: <ADMIN_SECRET>`.

```bash
# Create a group
curl -X POST http://localhost:3000/admin/groups \
  -H "X-Admin-Secret: my-secret" \
  -H "Content-Type: application/json" \
  -d '{"name":"production","description":"Production group"}'

# Issue a group token (shown once — store securely!)
curl -X POST http://localhost:3000/admin/groups/<group-id>/tokens \
  -H "X-Admin-Secret: my-secret" \
  -d '{"name":"agent-token","ttlSec":86400}'

# Register an OAS entry
curl -X POST http://localhost:3000/admin/oas \
  -H "X-Admin-Secret: my-secret" \
  -d '{
    "groupId": "<group-id>",
    "name": "payments",
    "remoteUrl": "https://api.example.com/openapi.json",
    "authType": "bearer",
    "authConfig": {"type":"bearer","token":"<api-token>"}
  }'
```

## Supported Auth Types

| `authType` | `authConfig` shape |
|------------|-------------------|
| `none` | `{ "type": "none" }` |
| `bearer` | `{ "type": "bearer", "token": "..." }` |
| `api_key` | `{ "type": "api_key", "key": "...", "in": "header\|query", "name": "X-API-Key" }` |
| `basic` | `{ "type": "basic", "username": "...", "password": "..." }` |
| `oauth2_cc` | `{ "type": "oauth2_cc", "tokenUrl": "...", "clientId": "...", "clientSecret": "...", "scopes": [] }` |

Auth configs are encrypted with AES-256-GCM at rest.

## Health & Metrics

- `GET /api/v1/health` — liveness probe (always 200)
- `GET /api/v1/ready` — readiness probe (checks cache connectivity)
- `GET /metrics` — Prometheus metrics (IP-restricted)
