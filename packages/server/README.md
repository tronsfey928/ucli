<p align="center">
  <img src="../../assets/logo.svg" alt="OAS Gateway" width="480" />
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@tronsfey/oas-server"><img src="https://img.shields.io/npm/v/@tronsfey/oas-server?color=7c3aed" alt="npm version"/></a>
  <img src="https://img.shields.io/badge/NestJS-v11-e0234e" alt="NestJS"/>
  <img src="https://img.shields.io/badge/node-%3E%3D18-38bdf8" alt="node"/>
  <img src="https://img.shields.io/badge/license-MIT-22c55e" alt="license"/>
</p>

<p align="center">
  <a href="#english">English</a> | <a href="#chinese">中文</a>
</p>

---

<a id="english"></a>

## English

### Overview

`@tronsfey/oas-server` is the server component of OAS Gateway. It provides:

- **Encrypted OAS storage** — OpenAPI specs with auth configs encrypted at rest (AES-256-GCM)
- **Group-scoped JWT issuance** — RS256-signed tokens that control which specs a client can access
- **Token revocation** — blacklist via cache (JTI-based)
- **Pluggable backends** — swap storage (memory / PostgreSQL / MySQL) and cache (memory / Redis) via env vars
- **Observability** — structured JSON logging (Pino), Prometheus metrics, health/readiness probes

### Architecture

```mermaid
graph TB
    subgraph AppModule["AppModule"]
        direction TB
        Config["ConfigModule\n(Joi-validated env)"]
        Auth["AuthModule\nAdminGuard · GroupTokenGuard"]
        Crypto["CryptoModule\nJwtService (RS256)\nEncryptionService (AES-256-GCM)"]

        subgraph Storage["StorageModule.forRoot()"]
            Mem1["MemoryGroupRepo\nMemoryTokenRepo\nMemoryOASRepo"]
            DB1["TypeORM repos\n(postgres · mysql)"]
        end

        subgraph Cache["CacheModule.forRoot()"]
            Mem2["MemoryCacheAdapter"]
            Redis["RedisCacheAdapter\n(ioredis)"]
        end

        Groups["GroupsModule\nPOST/GET /admin/groups"]
        Tokens["TokensModule\nPOST /admin/groups/:id/tokens\nDELETE /admin/tokens/:id"]
        OAS["OASModule\nAdmin CRUD + Client read"]
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
    Cache --> Auth
    Groups --> Tokens
    Groups --> OAS
```

### Installation

```bash
npm install -g @tronsfey/oas-server
# or
pnpm add -g @tronsfey/oas-server
```

### Quick Start (memory mode — no DB/Redis required)

```bash
# 1. Generate a 32-byte encryption key
ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

# 2. Start the server
ADMIN_SECRET=my-secret ENCRYPTION_KEY=$ENCRYPTION_KEY oas-server

# Server starts on http://localhost:3000
# Swagger UI: http://localhost:3000/api/docs
```

### Environment Variables

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

### Storage Backends

| `DB_TYPE` | Driver | Notes |
|-----------|--------|-------|
| `memory` | — | Default. No persistence. Data lost on restart. |
| `postgres` | `pg` | PostgreSQL 12+ |
| `mysql` | `mysql2` | MySQL 5.7+ / MariaDB 10.3+ |

Tables are auto-created on first run.

```bash
# PostgreSQL
DB_TYPE=postgres \
DATABASE_URL=postgresql://user:pass@host:5432/oas_gateway \
ADMIN_SECRET=secret ENCRYPTION_KEY=<64-hex> oas-server

# MySQL
DB_TYPE=mysql \
DATABASE_URL=mysql://user:pass@host:3306/oas_gateway \
ADMIN_SECRET=secret ENCRYPTION_KEY=<64-hex> oas-server
```

### Cache Backends

| `CACHE_TYPE` | Notes |
|--------------|-------|
| `memory` | Default. In-process TTL cache. Lost on restart. |
| `redis` | Redis 6+ via ioredis. Shared across multiple instances. |

```bash
CACHE_TYPE=redis REDIS_URL=redis://:password@host:6379 \
ADMIN_SECRET=secret ENCRYPTION_KEY=<64-hex> oas-server
```

### Production Deployment

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
oas-server
```

### Admin API Reference

All admin endpoints require the `X-Admin-Secret: <ADMIN_SECRET>` header.

#### Groups

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

#### Tokens

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

#### OAS Entries

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

### Client API Reference

Client endpoints require `Authorization: Bearer <group-jwt>`.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/oas` | List OAS entries visible to the token's group |
| `GET` | `/api/v1/oas/:name` | Get a single OAS entry with decrypted auth |

### Auth Types

| `authType` | `authConfig` shape |
|------------|-------------------|
| `none` | `{ "type": "none" }` |
| `bearer` | `{ "type": "bearer", "token": "..." }` |
| `api_key` | `{ "type": "api_key", "key": "...", "in": "header\|query", "name": "X-API-Key" }` |
| `basic` | `{ "type": "basic", "username": "...", "password": "..." }` |
| `oauth2_cc` | `{ "type": "oauth2_cc", "tokenUrl": "...", "clientId": "...", "clientSecret": "...", "scopes": [] }` |

Auth configs are encrypted with AES-256-GCM before storage. They are decrypted in-memory only at request time.

### Health & Observability

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/health` | `GET` | Liveness probe — always `200 OK` |
| `/api/v1/ready` | `GET` | Readiness probe — checks storage + cache adapters |
| `/metrics` | `GET` | Prometheus metrics (IP-restricted by default) |
| `/api/docs` | `GET` | Swagger UI (disable with `SWAGGER_ENABLED=false`) |
| `/api/openapi.json` | `GET` | OpenAPI 3.0 JSON spec |

### Security Model

- **At rest**: `authConfig` fields are encrypted with AES-256-GCM (256-bit key, random IV per record)
- **In transit**: Decrypted auth is only sent to authenticated CLI clients over TLS
- **JWT**: RS256-signed, JTI-tracked for revocation via cache blacklist
- **Admin auth**: `X-Admin-Secret` header checked via constant-time comparison
- **Never logged**: Auth configs are never written to logs or exposed in error messages

---

<a id="chinese"></a>

## 中文

### 概述

`@tronsfey/oas-server` 是 OAS Gateway 的服务端组件，提供：

- **加密 OAS 存储** — OpenAPI 规范及认证配置以 AES-256-GCM 静态加密
- **群组级 JWT 签发** — RS256 签名令牌，控制客户端可访问的规范范围
- **令牌吊销** — 基于 JTI 的缓存黑名单机制
- **可插拔后端** — 通过环境变量切换存储（memory / PostgreSQL / MySQL）和缓存（memory / Redis）
- **可观测性** — Pino 结构化 JSON 日志、Prometheus 指标、健康/就绪探针

### 架构图

```mermaid
graph TB
    subgraph AppModule["AppModule（应用模块）"]
        direction TB
        Config["ConfigModule\n（Joi 校验环境变量）"]
        Auth["AuthModule\nAdminGuard · GroupTokenGuard"]
        Crypto["CryptoModule\nJwtService (RS256)\nEncryptionService (AES-256-GCM)"]

        subgraph Storage["StorageModule.forRoot()（存储模块）"]
            Mem1["MemoryGroupRepo\nMemoryTokenRepo\nMemoryOASRepo"]
            DB1["TypeORM 仓库\n(postgres · mysql)"]
        end

        subgraph Cache["CacheModule.forRoot()（缓存模块）"]
            Mem2["MemoryCacheAdapter"]
            Redis["RedisCacheAdapter\n(ioredis)"]
        end

        Groups["GroupsModule\nPOST/GET /admin/groups"]
        Tokens["TokensModule\n令牌签发 + 吊销"]
        OAS["OASModule\n管理端 CRUD + 客户端读取"]
        Health["HealthModule\n存活 · 就绪探针"]
        Metrics["MetricsModule\nPrometheus 指标"]
    end

    Config --> Auth
    Config --> Storage
    Config --> Cache
    Crypto --> Tokens
    Crypto --> OAS
    Storage --> Groups
    Storage --> Tokens
    Storage --> OAS
    Cache --> Auth
    Groups --> Tokens
    Groups --> OAS
```

### 安装

```bash
npm install -g @tronsfey/oas-server
# 或
pnpm add -g @tronsfey/oas-server
```

### 快速开始（内存模式，无需 DB/Redis）

```bash
# 1. 生成 32 字节加密密钥
ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

# 2. 启动服务器
ADMIN_SECRET=my-secret ENCRYPTION_KEY=$ENCRYPTION_KEY oas-server

# 服务启动于 http://localhost:3000
# Swagger UI: http://localhost:3000/api/docs
```

### 环境变量

| 变量 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| `ADMIN_SECRET` | **是** | — | `X-Admin-Secret` 请求头的值（≥ 8 字符） |
| `ENCRYPTION_KEY` | **是** | — | 64 位十六进制（32 字节），用于 AES-256-GCM |
| `PORT` | 否 | `3000` | HTTP 监听端口 |
| `HOST` | 否 | `0.0.0.0` | HTTP 监听主机 |
| `DB_TYPE` | 否 | `memory` | `memory` \| `postgres` \| `mysql` |
| `DATABASE_URL` | 使用 DB 时 | — | 数据库连接 URL |
| `CACHE_TYPE` | 否 | `memory` | `memory` \| `redis` |
| `REDIS_URL` | 使用 redis 时 | — | Redis 连接 URL |
| `JWT_PRIVATE_KEY` | 生产环境 | 自动生成 | Base64 编码的 PKCS8 PEM |
| `JWT_PUBLIC_KEY` | 生产环境 | 自动生成 | Base64 编码的 SPKI PEM |
| `JWT_DEFAULT_TTL` | 否 | `86400` | 令牌有效期（秒），`0` 表示永不过期 |
| `LOG_LEVEL` | 否 | `info` | `trace` \| `debug` \| `info` \| `warn` \| `error` \| `fatal` |
| `SWAGGER_ENABLED` | 否 | `true` | 设为 `false` 可在生产环境关闭 `/api/docs` |

### 存储后端

| `DB_TYPE` | 驱动 | 说明 |
|-----------|------|------|
| `memory` | — | 默认。无持久化，重启后数据丢失。 |
| `postgres` | `pg` | PostgreSQL 12+ |
| `mysql` | `mysql2` | MySQL 5.7+ / MariaDB 10.3+ |

首次运行时自动建表。

```bash
# PostgreSQL
DB_TYPE=postgres \
DATABASE_URL=postgresql://user:pass@host:5432/oas_gateway \
ADMIN_SECRET=secret ENCRYPTION_KEY=<64位hex> oas-server

# MySQL
DB_TYPE=mysql \
DATABASE_URL=mysql://user:pass@host:3306/oas_gateway \
ADMIN_SECRET=secret ENCRYPTION_KEY=<64位hex> oas-server
```

### 缓存后端

| `CACHE_TYPE` | 说明 |
|--------------|------|
| `memory` | 默认。进程内 TTL 缓存，重启后失效。 |
| `redis` | Redis 6+（ioredis），支持多实例共享。 |

```bash
CACHE_TYPE=redis REDIS_URL=redis://:password@host:6379 \
ADMIN_SECRET=secret ENCRYPTION_KEY=<64位hex> oas-server
```

### 生产部署

生成持久化 RS256 密钥对，使令牌在重启后仍然有效：

```bash
node -e "
const { generateKeyPairSync } = require('crypto');
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
console.log('JWT_PRIVATE_KEY=' + Buffer.from(privateKey.export({ type:'pkcs8', format:'pem' })).toString('base64'));
console.log('JWT_PUBLIC_KEY=' + Buffer.from(publicKey.export({ type:'spki', format:'pem' })).toString('base64'));
"
```

使用仓库根目录的 `docker-compose.yml` 启动 PostgreSQL + Redis：

```bash
docker-compose up -d
DB_TYPE=postgres CACHE_TYPE=redis \
DATABASE_URL=postgresql://oas_gateway:changeme@localhost:5432/oas_gateway \
REDIS_URL=redis://:changeme@localhost:6379 \
JWT_PRIVATE_KEY=<base64-pem> JWT_PUBLIC_KEY=<base64-pem> \
ADMIN_SECRET=<强密码> ENCRYPTION_KEY=<64位hex> \
oas-server
```

### 管理 API 参考

所有管理端点均需要 `X-Admin-Secret: <ADMIN_SECRET>` 请求头。

#### 群组管理

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/admin/groups` | 创建群组 |
| `GET` | `/admin/groups` | 列出所有群组 |

```bash
# 创建群组
curl -X POST http://localhost:3000/admin/groups \
  -H "X-Admin-Secret: my-secret" \
  -H "Content-Type: application/json" \
  -d '{"name":"production","description":"生产环境智能体群组"}'

# 列出群组
curl http://localhost:3000/admin/groups \
  -H "X-Admin-Secret: my-secret"
```

#### 令牌管理

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/admin/groups/:id/tokens` | 为群组签发 JWT |
| `DELETE` | `/admin/tokens/:id` | 吊销令牌 |

```bash
# 签发令牌（返回的 JWT 仅显示一次，请妥善保存！）
curl -X POST http://localhost:3000/admin/groups/<group-id>/tokens \
  -H "X-Admin-Secret: my-secret" \
  -H "Content-Type: application/json" \
  -d '{"name":"agent-token","ttlSec":86400}'

# 吊销令牌
curl -X DELETE http://localhost:3000/admin/tokens/<jti-uuid> \
  -H "X-Admin-Secret: my-secret"
```

#### OAS 条目管理

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/admin/oas` | 注册 OAS 条目 |
| `GET` | `/admin/oas` | 列出所有 OAS 条目 |
| `PUT` | `/admin/oas/:id` | 更新 OAS 条目 |
| `DELETE` | `/admin/oas/:id` | 删除 OAS 条目 |

```bash
# 注册 OAS 条目
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
```

### 认证类型

| `authType` | `authConfig` 结构 |
|------------|------------------|
| `none` | `{ "type": "none" }` |
| `bearer` | `{ "type": "bearer", "token": "..." }` |
| `api_key` | `{ "type": "api_key", "key": "...", "in": "header\|query", "name": "X-API-Key" }` |
| `basic` | `{ "type": "basic", "username": "...", "password": "..." }` |
| `oauth2_cc` | `{ "type": "oauth2_cc", "tokenUrl": "...", "clientId": "...", "clientSecret": "...", "scopes": [] }` |

认证配置在存储前以 AES-256-GCM 加密，仅在请求处理时在内存中解密。

### 健康检查与可观测性

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/v1/health` | `GET` | 存活探针，始终返回 `200 OK` |
| `/api/v1/ready` | `GET` | 就绪探针，检查存储和缓存适配器 |
| `/metrics` | `GET` | Prometheus 指标（默认 IP 限制） |
| `/api/docs` | `GET` | Swagger UI（`SWAGGER_ENABLED=false` 可关闭） |
| `/api/openapi.json` | `GET` | OpenAPI 3.0 JSON 规范 |

### 安全模型

- **静态加密**：`authConfig` 字段以 AES-256-GCM（256 位密钥，每条记录随机 IV）加密
- **传输安全**：解密后的认证信息仅通过 TLS 传输给已认证的 CLI 客户端
- **JWT 安全**：RS256 签名，通过缓存黑名单追踪 JTI 实现吊销
- **管理认证**：`X-Admin-Secret` 请求头通过常量时间比较验证
- **不落日志**：认证配置永不写入日志或错误消息
